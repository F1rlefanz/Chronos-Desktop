import { invoke } from '@tauri-apps/api/core';
import { FileSink } from './fileTarget';

/**
 * Writes exports to `%LOCALAPPDATA%\Chronos\exports\` through Rust, and opens
 * that folder afterwards — the desktop equivalent of a browser download.
 */
export const tauriFileSink: FileSink = {
  async write(name: string, bytes: Uint8Array): Promise<string> {
    // Tauri serialises the payload as JSON, which has no byte array — a plain
    // number array is what the Vec<u8> parameter on the Rust side accepts.
    return await invoke<string>('export_write', { name, bytes: Array.from(bytes) });
  },

  async reveal(): Promise<void> {
    await invoke('reveal_folder', { target: 'exports' });
  },
};
