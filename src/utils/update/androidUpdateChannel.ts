import { invoke } from '@tauri-apps/api/core';
import { logInfo, logWarn } from '../logging/logger';
import { isNewer } from './index';
import { UpdateChannel } from './types';

/**
 * Where the phone looks. A file on the latest public release rather than the
 * releases API: a static asset comes off a CDN with no rate limit, where the
 * API allows sixty unauthenticated calls an hour per address — which a household
 * behind one address could plausibly reach, and an update check that starts
 * failing at lunchtime is worse than none.
 */
const MANIFEST =
  'https://github.com/F1rlefanz/Chronos-Desktop/releases/latest/download/latest-android.json';

/** What that file holds. Written by the release workflow, read only here. */
export interface AndroidManifest {
  version: string;
  notes: string;
  url: string;
}

/**
 * Anything read off the network is input, exactly as an imported file is.
 *
 * The manifest decides which URL this app downloads an APK from and hands to
 * the system installer, so a shape that is merely *probably* right is not good
 * enough: every field is checked, and the URL has to be HTTPS on GitHub. Nothing
 * here defends against a compromised release — that is what signing the APK is
 * for — but it does mean a mangled or truncated file is refused rather than
 * followed somewhere unexpected.
 */
export function readManifest(raw: string): AndroidManifest | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

  const record = parsed as Record<string, unknown>;
  const { version, notes, url } = record;

  if (typeof version !== 'string' || typeof url !== 'string') return null;

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return null;
  }

  if (target.protocol !== 'https:') return null;
  if (target.hostname !== 'github.com' && !target.hostname.endsWith('.githubusercontent.com')) {
    return null;
  }
  if (!target.pathname.endsWith('.apk')) return null;

  return { version, notes: typeof notes === 'string' ? notes : '', url };
}

/**
 * The phone half: fetch a manifest, and ask Android to install what it names.
 *
 * Unlike the desktop there is no downloading *and* installing in one step that
 * the app controls. It ends at Android's own installer screen, and whether the
 * user agrees there is not something this can find out — so `install` resolves
 * once the system has been handed the file, which is genuinely all that is
 * known at that point.
 */
export function androidUpdateChannel(currentVersion: string): UpdateChannel {
  return {
    async check() {
      const { text } = await invoke<{ text: string }>('plugin:chronos-update|fetch_text', {
        payload: { url: MANIFEST },
      });

      const manifest = readManifest(text);
      if (!manifest) {
        logWarn('[Update] The Android manifest could not be read.');
        return null;
      }

      if (!isNewer(manifest.version, currentVersion)) return null;

      return {
        version: manifest.version,
        notes: manifest.notes,
        install: async (onProgress) => {
          // No progress to report: the download happens inside the plugin and
          // Android gives no callback worth threading back out. `null` is the
          // honest answer — "working, length unknown" — and the interface shows
          // that rather than a bar that would have to be made up.
          onProgress?.(null);

          const result = await invoke<{ started: boolean; needsPermission: boolean }>(
            'plugin:chronos-update|download_and_install',
            { payload: { url: manifest.url } }
          );

          if (result.needsPermission) {
            throw new Error(
              'Android muss Chronos erst erlauben, Apps zu installieren. Die Einstellung dafür ist gerade aufgegangen — dort den Schalter umlegen und es noch einmal versuchen.'
            );
          }

          logInfo(`[Update] Handed ${manifest.version} to the system installer.`);
        },
      };
    },
  };
}
