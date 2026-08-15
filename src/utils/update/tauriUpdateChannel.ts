import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { logInfo } from '../logging/logger';
import { UpdateChannel } from './types';

/**
 * The desktop half: Tauri fetches a signed manifest and replaces the install.
 *
 * The signature is the point. The manifest and the bundle come over plain HTTP
 * with no credentials — that is what makes a public release usable as an update
 * feed at all — so nothing about the transport says the bundle is ours. The
 * public key in `tauri.conf.json` does; a bundle signed with anything else is
 * refused before a byte of it is run, and the private half exists only on a
 * machine of ours and in a repository secret.
 */
export const tauriUpdateChannel: UpdateChannel = {
  async check() {
    const update = await check();
    if (!update) return null;

    return {
      version: update.version,
      notes: update.body ?? '',
      install: async (onProgress) => {
        let total = 0;
        let received = 0;

        await update.downloadAndInstall((event) => {
          if (!onProgress) return;

          // `contentLength` is absent when the server sends no length, which is
          // a real case behind a proxy — the bar then has to say "working"
          // rather than a wrong number, which is what `null` means here.
          if (event.event === 'Started') {
            total = event.data.contentLength ?? 0;
            received = 0;
            onProgress(total > 0 ? 0 : null);
          } else if (event.event === 'Progress') {
            received += event.data.chunkLength;
            onProgress(total > 0 ? Math.min(received / total, 1) : null);
          } else if (event.event === 'Finished') {
            onProgress(1);
          }
        });

        logInfo(`[Update] ${update.version} installed; restarting.`);
        await relaunch();
      },
    };
  },
};
