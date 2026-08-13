import { invoke } from '@tauri-apps/api/core';
import { logError, logWarn } from '../logging/logger';
import { BackupSupport, StorageAdapter, WriteFailureReason, WriteResult } from './types';

/**
 * The shape `StorageError` in `src-tauri/src/lib.rs` serialises to. Errors
 * crossing the IPC boundary arrive as plain values, so they are narrowed here
 * rather than trusted.
 */
interface RustStorageError {
  reason: WriteFailureReason;
  message: string;
}

const REASONS: readonly WriteFailureReason[] = ['quota', 'unavailable', 'io'];

function isRustStorageError(error: unknown): error is RustStorageError {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as Record<string, unknown>;
  return (
    typeof candidate.message === 'string' &&
    REASONS.includes(candidate.reason as WriteFailureReason)
  );
}

function toWriteResult(error: unknown): WriteResult {
  if (isRustStorageError(error)) {
    return { ok: false, reason: error.reason, message: error.message };
  }

  // An error that is not our own means the command itself failed to run.
  return {
    ok: false,
    reason: 'unavailable',
    message: 'Die Desktop-Ablage hat auf das Speichern nicht reagiert.',
  };
}

const backups: BackupSupport = {
  async list(): Promise<string[]> {
    try {
      return await invoke<string[]>('backup_list');
    } catch (error) {
      // Not knowing what is there is not a reason to stop; the caller treats an
      // empty list as "no snapshot today yet" and writes one.
      logWarn('[Backup] Could not list backups:', error);
      return [];
    }
  },

  async write(name: string, contents: string): Promise<WriteResult> {
    try {
      await invoke('backup_write', { name, contents });
      return { ok: true };
    } catch (error) {
      logError(`[Backup] Error writing "${name}":`, error);
      return toWriteResult(error);
    }
  },

  async reveal(): Promise<void> {
    await invoke('reveal_folder', { target: 'backups' });
  },
};

/**
 * Persists through the Rust side, which writes to
 * `%LOCALAPPDATA%\Chronos\data\<key>.json` via a temporary file and a rename,
 * so a crash cannot leave a half-written file behind.
 */
export const tauriAdapter: StorageAdapter = {
  backups,

  name: 'tauri',

  async read(key: string): Promise<string | null> {
    try {
      return await invoke<string | null>('storage_read', { key });
    } catch (error) {
      // A read that fails must not stop the app from starting; the caller
      // falls back to the default for this key.
      logWarn(`[Storage] Error reading key "${key}" from disk:`, error);
      return null;
    }
  },

  async write(key: string, value: string): Promise<WriteResult> {
    try {
      await invoke('storage_write', { key, value });
      return { ok: true };
    } catch (error) {
      logError(`[Storage] Error writing key "${key}" to disk:`, error);
      return toWriteResult(error);
    }
  },
};
