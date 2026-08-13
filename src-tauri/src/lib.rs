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

    let base = app.path().app_local_data_dir().map_err(|error| {
        StorageError::rejected(format!(
            "Could not locate the application data folder: {error}."
        ))
    })?;

    // Data sits in its own subfolder so that a backups/ sibling can be added
    // later without mixing the two.
    Ok(base.join("data").join(format!("{key}.json")))
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
#[tauri::command]
fn storage_write(app: tauri::AppHandle, key: String, value: String) -> Result<(), StorageError> {
    let path = data_file(&app, &key)?;

    let directory = path
        .parent()
        .ok_or_else(|| StorageError::rejected("Resolved a data path without a parent.".into()))?;

    fs::create_dir_all(directory).map_err(|error| StorageError::from_io(&error, &path))?;

    let sequence = WRITE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temporary = path.with_extension(format!("json.{sequence}.tmp"));

    let write_temporary = || -> std::io::Result<()> {
        let mut file = fs::File::create(&temporary)?;
        file.write_all(value.as_bytes())?;
        // Without this the rename can land before the contents reach the disk,
        // which is exactly the crash window the rename is meant to close.
        file.sync_all()
    };

    if let Err(error) = write_temporary() {
        let _ = fs::remove_file(&temporary);
        return Err(StorageError::from_io(&error, &temporary));
    }

    fs::rename(&temporary, &path).map_err(|error| {
        let _ = fs::remove_file(&temporary);
        StorageError::from_io(&error, &path)
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![storage_read, storage_write])
        .run(tauri::generate_context!())
        .expect("error while running Chronos Desktop");
}
