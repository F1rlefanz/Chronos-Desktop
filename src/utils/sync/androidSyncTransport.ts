import { invoke } from '@tauri-apps/api/core';
import { SyncTransport } from './types';

/**
 * Which of the plugin's two folders this is about. The other one holds this
 * phone's own exports and backups and has nothing to do with syncing — see
 * `src/utils/androidFiles.ts`.
 */
const ROLE = 'sync';

/**
 * The same five operations as on the desktop, against a folder Android will
 * not give a path to.
 *
 * `configure` carries the tree URI the picker returned; everything after it
 * names a file, and the Kotlin side resolves that against the tree and nothing
 * else — the same shape as `sync_configure` on the desktop, for the same
 * reason. That the two backends could not be more different underneath is
 * exactly what `SyncTransport` is for: `runSync` never learns which one it got.
 */
export const androidSyncTransport: SyncTransport = {
  async configure(folder: string): Promise<void> {
    await invoke('plugin:chronos-saf|configure', { payload: { role: ROLE, folder } });
  },

  async list(): Promise<string[]> {
    const { files } = await invoke<{ files: string[] }>('plugin:chronos-saf|list_files', {
      payload: { role: ROLE },
    });
    return files;
  },

  async read(name: string): Promise<string | null> {
    const { contents } = await invoke<{ contents: string | null }>('plugin:chronos-saf|read_file', {
      payload: { role: ROLE, name },
    });
    return contents;
  },

  async write(name: string, contents: string): Promise<void> {
    await invoke('plugin:chronos-saf|write_file', { payload: { role: ROLE, name, contents } });
  },

  async pickFolder(): Promise<string | null> {
    const { uri } = await invoke<{ uri: string | null }>('plugin:chronos-saf|pick_folder');
    return uri;
  },
};
