use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use serde::Serialize;
use tauri::Manager;

/// Mirrors the failing half of `WriteResult` in `src/utils/storage/types.ts`.
/// `reason` is one of the `WriteFailureReason` values; `message` is shown to
/// the user in the persistence banner, so it has to read as a sentence.
#[derive(Debug, Serialize)]
pub struct StorageError {
    reason: &'static str,
    message: String,
}

/// Windows reports a full volume through two distinct codes.
const ERROR_HANDLE_DISK_FULL: i32 = 39;
const ERROR_DISK_FULL: i32 = 112;

impl StorageError {
    fn from_io(error: &std::io::Error, path: &Path) -> Self {
        let full = matches!(
            error.raw_os_error(),
            Some(ERROR_HANDLE_DISK_FULL) | Some(ERROR_DISK_FULL)
        );

        if full {
            return Self {
                reason: "quota",
                message: "The disk is full — free some space and try again.".into(),
            };
        }

        if error.kind() == std::io::ErrorKind::PermissionDenied {
            return Self {
                reason: "unavailable",
                message: format!("No permission to write to {}.", path.display()),
            };
        }

        Self {
            reason: "io",
            message: format!("Could not write to {}: {error}.", path.display()),
        }
    }

    fn rejected(message: String) -> Self {
        Self {
            reason: "io",
            message,
        }
    }
}

/// Distinguishes concurrent writes to the same key, so two in-flight saves
/// cannot fight over one temporary file.
static WRITE_COUNTER: AtomicU64 = AtomicU64::new(0);

/// The folder holding user data, under the OS-level local data directory.
///
/// Deliberately not Tauri's `app_local_data_dir()`, which appends the bundle
/// identifier: that would tie the location of the user's data to the app's
/// install identity, and renaming the identifier later would orphan every
/// existing recording. Keeping the two apart also means the folder is
/// something a person can find in Explorer.
///
/// It is also deliberately *not* the product name. The NSIS installer puts the
/// program itself in `%LOCALAPPDATA%\Chronos Desktop`, so using that name here
/// would drop the user's recordings into the application folder — where anyone
/// uninstalling by deleting the folder takes their data with them.
const DATA_FOLDER: &str = "Chronos";

/// How many snapshots survive in backups/. Older ones are pruned after each
/// write, so the folder cannot grow without bound.
///
/// Raised from ten when a second snapshot per day was added on window close:
/// the same number would otherwise have halved how far back the folder reaches.
const BACKUP_RETENTION: usize = 20;

/// Resolves the folder holding the app's data and its backups/ sibling.
fn app_folder(app: &tauri::AppHandle) -> Result<PathBuf, StorageError> {
    let base = app.path().local_data_dir().map_err(|error| {
        StorageError::rejected(format!("Could not locate the local data folder: {error}."))
    })?;

    Ok(base.join(DATA_FOLDER))
}

/// Resolves a storage key to its file, rejecting anything that is not a plain
/// key. The keys come from `STORAGE_KEYS`, but this runs on values crossing the
/// IPC boundary, so it validates rather than trusts: without this, a key
/// containing `..` would let the front end write anywhere on disk.
fn data_file(app: &tauri::AppHandle, key: &str) -> Result<PathBuf, StorageError> {
    let valid = !key.is_empty()
        && key
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-');

    if !valid {
        return Err(StorageError::rejected(format!(
            "Rejected the storage key \"{key}\"."
        )));
    }

    // Data sits in its own subfolder, next to backups/.
    Ok(app_folder(app)?.join("data").join(format!("{key}.json")))
}

#[tauri::command]
fn storage_read(app: tauri::AppHandle, key: String) -> Result<Option<String>, StorageError> {
    let path = data_file(&app, &key)?;

    match fs::read_to_string(&path) {
        Ok(contents) => Ok(Some(contents)),
        // A key that was never written is not an error.
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(StorageError::from_io(&error, &path)),
    }
}

/// Writes through a temporary file and renames it into place. A rename is
/// atomic, so a crash mid-write leaves either the previous file or the new one
/// — never a truncated file that would fail to parse on the next start.
fn write_atomically(path: &Path, value: &[u8]) -> Result<(), StorageError> {
    let directory = path
        .parent()
        .ok_or_else(|| StorageError::rejected("Resolved a path without a parent.".into()))?;

    fs::create_dir_all(directory).map_err(|error| StorageError::from_io(&error, path))?;

    let sequence = WRITE_COUNTER.fetch_add(1, Ordering::Relaxed);
    // Not tied to the target's extension: this also writes PDFs and CSVs now.
    let temporary = path.with_extension(format!("{sequence}.tmp"));

    let write_temporary = || -> std::io::Result<()> {
        let mut file = fs::File::create(&temporary)?;
        file.write_all(value)?;
        // Without this the rename can land before the contents reach the disk,
        // which is exactly the crash window the rename is meant to close.
        file.sync_all()
    };

    if let Err(error) = write_temporary() {
        let _ = fs::remove_file(&temporary);
        return Err(StorageError::from_io(&error, &temporary));
    }

    fs::rename(&temporary, path).map_err(|error| {
        let _ = fs::remove_file(&temporary);
        StorageError::from_io(&error, path)
    })
}

#[tauri::command]
fn storage_write(app: tauri::AppHandle, key: String, value: String) -> Result<(), StorageError> {
    let path = data_file(&app, &key)?;
    write_atomically(&path, value.as_bytes())
}

/* -------------------------------------------------------------------------- */
/* Backups                                                                    */
/* -------------------------------------------------------------------------- */

/// Validates a file name the front end composed. These arrive over IPC like any
/// other argument, so a name containing a separator or `..` would turn a write
/// into a write anywhere on disk.
fn checked_name<'a>(name: &'a str, extensions: &[&str]) -> Result<&'a str, StorageError> {
    let extension_ok = extensions
        .iter()
        .any(|ext| name.ends_with(ext) && name.len() > ext.len());

    let valid = extension_ok
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-' || b == b'.' || b == b'+')
        && !name.contains("..");

    if !valid {
        return Err(StorageError::rejected(format!(
            "Rejected the file name \"{name}\"."
        )));
    }

    Ok(name)
}

fn backup_path(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, StorageError> {
    let name = checked_name(name, &[".json"])?;
    Ok(app_folder(app)?.join("backups").join(name))
}

/// Existing snapshots, oldest first.
///
/// The names begin with a sortable timestamp, so lexicographic order is
/// chronological order — no need to trust filesystem timestamps, which a copy
/// or a restore would rewrite.
#[tauri::command]
fn backup_list(app: tauri::AppHandle) -> Result<Vec<String>, StorageError> {
    let directory = app_folder(&app)?.join("backups");

    let entries = match fs::read_dir(&directory) {
        Ok(entries) => entries,
        // Nothing has been backed up yet.
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(StorageError::from_io(&error, &directory)),
    };

    let mut names: Vec<String> = entries
        .filter_map(Result::ok)
        .filter_map(|entry| entry.file_name().into_string().ok())
        .filter(|name| name.ends_with(".json"))
        .collect();

    names.sort();
    Ok(names)
}

/// Writes one snapshot, then deletes the oldest until BACKUP_RETENTION remain.
#[tauri::command]
fn backup_write(app: tauri::AppHandle, name: String, contents: String) -> Result<(), StorageError> {
    let path = backup_path(&app, &name)?;
    write_atomically(&path, contents.as_bytes())?;

    // Pruning failures are not reported: the snapshot itself succeeded, which
    // is what the caller asked for, and a folder one file over the limit is not
    // worth a warning the user cannot act on.
    if let Ok(names) = backup_list(app.clone()) {
        let directory = path.parent();
        for stale in names.iter().rev().skip(BACKUP_RETENTION) {
            if let Some(directory) = directory {
                let _ = fs::remove_file(directory.join(stale));
            }
        }
    }

    Ok(())
}

/* -------------------------------------------------------------------------- */
/* Exports                                                                    */
/* -------------------------------------------------------------------------- */

/// Writes a generated report and answers with the path it landed on.
///
/// A desktop build cannot hand a file to the user the way a browser does: the
/// `<a download>` the web build relies on is simply ignored by the WebView, so
/// the export appeared to do nothing at all. Writing the file ourselves and
/// showing the folder replaces that, and needs no dialog plugin.
///
/// Takes bytes rather than a string because one of the three formats is a PDF.
#[tauri::command]
fn export_write(
    app: tauri::AppHandle,
    name: String,
    bytes: Vec<u8>,
) -> Result<String, StorageError> {
    let name = checked_name(&name, &[".pdf", ".csv", ".json"])?;
    let path = app_folder(&app)?.join("exports").join(name);

    write_atomically(&path, &bytes)?;
    Ok(path.display().to_string())
}

/* -------------------------------------------------------------------------- */
/* Log file                                                                   */
/* -------------------------------------------------------------------------- */

/// Size at which the log is rolled over. Two files of this size is the whole
/// disk budget for logging.
const LOG_MAX_BYTES: u64 = 1024 * 1024;

const LOG_FILE: &str = "chronos.log";
const LOG_PREVIOUS: &str = "chronos.log.1";

/// Appends one line to the log, rolling the file over when it grows too large.
///
/// Appending rather than the atomic write used elsewhere is deliberate: a log
/// grows by one line at a time, and rewriting the whole file per line would
/// turn a diagnostic aid into a performance problem. Losing the tail of a log
/// to a crash costs nothing, unlike losing a recording.
#[tauri::command]
fn log_append(app: tauri::AppHandle, line: String) -> Result<(), StorageError> {
    let directory = app_folder(&app)?.join("logs");
    fs::create_dir_all(&directory).map_err(|error| StorageError::from_io(&error, &directory))?;

    let path = directory.join(LOG_FILE);

    if let Ok(metadata) = fs::metadata(&path) {
        if metadata.len() >= LOG_MAX_BYTES {
            // A failed rollover must not stop the app from logging; the file
            // simply keeps growing until the next attempt succeeds.
            let _ = fs::rename(&path, directory.join(LOG_PREVIOUS));
        }
    }

    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| StorageError::from_io(&error, &path))?;

    writeln!(file, "{line}").map_err(|error| StorageError::from_io(&error, &path))
}

/* -------------------------------------------------------------------------- */
/* Revealing folders                                                          */
/* -------------------------------------------------------------------------- */

/// The command each desktop uses to show a folder to its user.
///
/// Three different programs for the same idea, and none of them exists on the
/// other systems — which is why this cannot be a single hardcoded `explorer`.
#[cfg(target_os = "windows")]
const FILE_MANAGER: &str = "explorer";
#[cfg(target_os = "macos")]
const FILE_MANAGER: &str = "open";
#[cfg(all(unix, not(target_os = "macos")))]
const FILE_MANAGER: &str = "xdg-open";

/// Opens one of the app's folders in the system file manager: `backups` so the
/// user can copy a snapshot out or feed it back through the JSON import, `logs`
/// so a log can be read or attached to a bug report, `exports` so a generated
/// report can be picked up.
///
/// The target is an enumerated name rather than a path — the front end never
/// gets to say which directory is opened.
#[tauri::command]
fn reveal_folder(app: tauri::AppHandle, target: String) -> Result<(), StorageError> {
    let subfolder = match target.as_str() {
        "backups" => "backups",
        "logs" => "logs",
        "exports" => "exports",
        other => {
            return Err(StorageError::rejected(format!(
                "Rejected the folder \"{other}\"."
            )))
        }
    };

    let directory = app_folder(&app)?.join(subfolder);
    fs::create_dir_all(&directory).map_err(|error| StorageError::from_io(&error, &directory))?;

    // A phone has no file manager to send the user to, and no expectation of
    // one. The front end hides the button there; this is the second line of
    // defence, so a stray call fails with something readable instead of
    // spawning a process that cannot exist.
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        let _ = directory;
        return Err(StorageError::rejected(
            "Opening a folder is not something this system does.".into(),
        ));
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Explorer exits with a non-zero status even when it succeeds, so the
        // status is deliberately not checked — only the spawn itself can fail.
        std::process::Command::new(FILE_MANAGER)
            .arg(&directory)
            .spawn()
            .map_err(|error| {
                StorageError::rejected(format!("Could not open {}: {error}.", directory.display()))
            })?;

        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            storage_read,
            storage_write,
            backup_list,
            backup_write,
            export_write,
            log_append,
            reveal_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running Chronos Desktop");
}
