import { invoke } from '@tauri-apps/api/core';
import { SyncTransport } from './types';

/**
 * Reads and writes in the folder the user chose, through the Rust side.
 *
 * `configure` is the only call that carries a path. Everything after it names a
 * file, and the Rust side resolves that name against the folder it was given —
 * so a bug in the front end cannot turn a sync into a write somewhere else on
 * the disk.
 */
export const tauriSyncTransport: SyncTransport = {
  async configure(folder: string): Promise<void> {
    await invoke('sync_configure', { folder });
  },

  list(): Promise<string[]> {
    return invoke<string[]>('sync_list');
  },

  read(name: string): Promise<string | null> {
    return invoke<string | null>('sync_read', { name });
  },

  async write(name: string, contents: string): Promise<void> {
    await invoke('sync_write', { name, contents });
  },

  async pickFolder(): Promise<string | null> {
    // Imported here rather than at the top of the file so the dialog plugin
    // stays out of the web bundle, which has no use for it.
    const { open } = await import('@tauri-apps/plugin-dialog');

    const chosen = await open({
      directory: true,
      multiple: false,
      title: 'Ordner für den Abgleich wählen',
    });

    return typeof chosen === 'string' ? chosen : null;
  },
};
