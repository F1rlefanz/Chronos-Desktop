import { invoke } from '@tauri-apps/api/core';
import { LogSink } from './types';

/**
 * Writes log lines to `%LOCALAPPDATA%\Chronos\logs\chronos.log`, which the Rust
 * side appends to and rolls over once it passes a megabyte.
 */
export const tauriLogSink: LogSink = {
  async write(line: string): Promise<void> {
    await invoke('log_append', { line });
  },

  async reveal(): Promise<void> {
    await invoke('reveal_folder', { target: 'logs' });
  },
};
