import { invoke } from '@tauri-apps/api/core';
import { logInfo, logWarn } from './logging/logger';
import { describeSyncFolder } from './sync/folderLabel';
import type { FileSink } from './fileTarget';
import type { BackupSupport, WriteResult } from './storage/types';

/**
 * Where a phone puts the files it makes for its user.
 *
 * On the desktop an export lands in `%LOCALAPPDATA%\Chronos\exports\` and a
 * button opens that folder. A phone has neither: everything the app writes
 * goes to app-private storage, which is real but unreachable — no file manager
 * leads there, so an export was a file the user could not have. Picking a
 * folder through the Storage Access Framework is what makes it theirs again.
 *
 * Until a folder is picked, both of these fall through to the app-private path
 * that has always existed. Nothing is lost by not choosing one; it is just
 * harder to get at.
 */
const ROLE = 'files';

/**
 * How many snapshots survive. The same number as `BACKUP_RETENTION` in
 * `src-tauri/src/lib.rs`, deliberately written twice: the desktop prunes in
 * Rust after its own write, and reaching across IPC to reuse that would mean
 * teaching the Rust side about a folder it cannot open.
 */
const BACKUP_RETENTION = 20;

/** What `backupName` produces, and the only thing pruning may delete. */
const BACKUP_PREFIX = 'chronos-backup-';

let folder = '';

/** Kept in step with `deviceFilesFolder` by an effect in `src/App.tsx`. */
export function setAndroidFilesFolder(next: string): void {
  folder = next;
}

export function androidFilesFolder(): string {
  return folder;
}

/** Opens the system picker; `null` when the user cancels. */
export async function pickAndroidFilesFolder(): Promise<string | null> {
  const { uri } = await invoke<{ uri: string | null }>('plugin:chronos-saf|pick_folder');
  return uri;
}

/**
 * Points the plugin at the chosen folder, and reports whether it is usable.
 *
 * Called before every operation rather than once: the grant can be withdrawn
 * between two exports, and the folder itself can be deleted. Asking each time
 * costs one query and turns "nothing happened" into a sentence.
 */
async function ready(): Promise<boolean> {
  if (!folder) return false;

  try {
    await invoke('plugin:chronos-saf|configure', { payload: { role: ROLE, folder } });
    return true;
  } catch (error) {
    logWarn('[Files] The chosen folder is not usable:', error);
    return false;
  }
}

/** Base64 in chunks: `String.fromCharCode(...bytes)` blows the stack on a PDF. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;

  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  return btoa(binary);
}

function mimeOf(name: string): string {
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.csv')) return 'text/csv';
  return 'application/json';
}

/** `Documents/Chronos/chronos_august.pdf` — what to tell the user afterwards. */
function whereItLanded(name: string): string {
  return `${describeSyncFolder(folder)}/${name}`;
}

export async function openAndroidFilesFolder(name?: string): Promise<void> {
  if (!(await ready())) return;
  await invoke('plugin:chronos-saf|open_document', { payload: { role: ROLE, name: name ?? null } });
}

/**
 * Writes exports into the chosen folder, or falls back to the app-private one.
 *
 * The fallback is the point: a phone with no folder chosen behaves exactly as
 * it did before, rather than losing the export button to a setting nobody knew
 * to fill in.
 */
export function androidFileSink(fallback: FileSink): FileSink {
  return {
    async write(name: string, bytes: Uint8Array): Promise<string> {
      if (!(await ready())) return fallback.write(name, bytes);

      await invoke('plugin:chronos-saf|write_bytes', {
        payload: { role: ROLE, name, mimeType: mimeOf(name), base64: toBase64(bytes) },
      });

      return whereItLanded(name);
    },

    async reveal(): Promise<void> {
      if (!folder) return fallback.reveal();
      await openAndroidFilesFolder();
    },
  };
}

/**
 * Keeps the rotating snapshots where the user can reach them.
 *
 * Same three operations as the desktop's, and the same twenty kept — only the
 * pruning happens here rather than in Rust, because the Rust side cannot open
 * this folder at all.
 */
export function androidBackupSupport(fallback: BackupSupport): BackupSupport {
  return {
    async list(): Promise<string[]> {
      if (!(await ready())) return fallback.list();

      try {
        const { files } = await invoke<{ files: string[] }>('plugin:chronos-saf|list_files', {
          payload: { role: ROLE },
        });
        // Only ours: the folder belongs to the user and may hold anything.
        return files.filter((name) => name.startsWith(BACKUP_PREFIX)).sort();
      } catch (error) {
        logWarn('[Backup] Could not list the chosen folder:', error);
        return [];
      }
    },

    async write(name: string, contents: string): Promise<WriteResult> {
      if (!(await ready())) return fallback.write(name, contents);

      try {
        await invoke('plugin:chronos-saf|write_file', {
          payload: { role: ROLE, name, contents },
        });
      } catch (error) {
        logWarn(`[Backup] Could not write "${name}" to the chosen folder:`, error);
        return {
          ok: false,
          reason: 'io',
          message: 'Die Sicherung konnte nicht in den gewählten Ordner geschrieben werden.',
        };
      }

      await prune();
      return { ok: true };
    },

    async reveal(): Promise<void> {
      if (!folder) return fallback.reveal();
      await openAndroidFilesFolder();
    },
  };

  /**
   * Deletes the oldest snapshots beyond the limit.
   *
   * The names begin with a sortable timestamp, so lexicographic order is
   * chronological — no need to trust a provider's idea of a modified date.
   * A failure is logged and swallowed: the snapshot itself succeeded, which is
   * what the caller asked for.
   */
  async function prune(): Promise<void> {
    try {
      const { files } = await invoke<{ files: string[] }>('plugin:chronos-saf|list_files', {
        payload: { role: ROLE },
      });

      const stale = files
        .filter((name) => name.startsWith(BACKUP_PREFIX))
        .sort()
        .slice(0, -BACKUP_RETENTION);

      for (const name of stale) {
        await invoke('plugin:chronos-saf|delete_file', { payload: { role: ROLE, name } });
      }

      if (stale.length > 0) logInfo(`[Backup] Pruned ${stale.length} old snapshot(s).`);
    } catch (error) {
      logWarn('[Backup] Could not prune old snapshots:', error);
    }
  }
}
