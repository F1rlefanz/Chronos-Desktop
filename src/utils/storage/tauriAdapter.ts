import { invoke } from '@tauri-apps/api/core';
import { StorageAdapter, WriteFailureReason, WriteResult } from './types';

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
    message: 'The desktop backend did not respond to the save.',
  };
}

/**
 * Persists through the Rust side, which writes to
 * `%LOCALAPPDATA%\Chronos Desktop\data\<key>.json` via a temporary file and a
 * rename, so a crash cannot leave a half-written file behind.
 */
export const tauriAdapter: StorageAdapter = {
  name: 'tauri',

  async read(key: string): Promise<string | null> {
    try {
      return await invoke<string | null>('storage_read', { key });
    } catch (error) {
      // A read that fails must not stop the app from starting; the caller
      // falls back to the default for this key.
      console.warn(`[Storage] Error reading key "${key}" from disk:`, error);
      return null;
    }
  },

  async write(key: string, value: string): Promise<WriteResult> {
    try {
      await invoke('storage_write', { key, value });
      return { ok: true };
    } catch (error) {
      console.error(`[Storage] Error writing key "${key}" to disk:`, error);
      return toWriteResult(error);
    }
  },
};
