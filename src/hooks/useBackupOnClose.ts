import { useEffect, useRef } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { backupsAvailable, writeBackup } from '../utils/storage';
import { logInfo, logWarn } from '../utils/logging/logger';

/** A hung snapshot must never leave the user unable to close the window. */
const CLOSE_TIMEOUT_MS = 3000;

/**
 * Takes a snapshot as the window closes.
 *
 * The daily snapshot is taken at startup, over the state it *finds* — so a
 * day's work is in no snapshot at all until the next launch. Closing the window
 * is the moment that work is finished, which makes it the natural second one.
 *
 * A background service was the alternative and would have been the wrong tool:
 * the data can only change through this app, so a service running while it is
 * closed would keep copying a file that cannot have changed.
 */
export function useBackupOnClose(buildContents: () => string): void {
  // Kept in a ref so the listener is attached once but always snapshots the
  // current state rather than whatever existed when it was registered. Updated
  // in an effect rather than during render, which React forbids for refs.
  const buildRef = useRef(buildContents);

  useEffect(() => {
    buildRef.current = buildContents;
  }, [buildContents]);

  useEffect(() => {
    // Both conditions, and neither is redundant: there is no window to listen
    // to outside Tauri, and no point listening when the backend keeps no
    // snapshots.
    if (!isTauri() || !backupsAvailable()) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();

        const stop = await appWindow.onCloseRequested(async (event) => {
          event.preventDefault();

          try {
            // Racing a timeout: a snapshot is worth waiting a moment for, but a
            // window that will not close is worse than a missing backup.
            const result = await Promise.race([
              writeBackup('on-close', buildRef.current()),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), CLOSE_TIMEOUT_MS)),
            ]);

            if (result === null) {
              logWarn('[Backup] Closing snapshot timed out; closing anyway.');
            } else if (result.ok) {
              logInfo('[Backup] Closing snapshot written.');
            } else {
              logWarn(`[Backup] Closing snapshot failed: ${result.message}`);
            }
          } catch (error) {
            logWarn('[Backup] Closing snapshot failed:', error);
          }

          await appWindow.destroy();
        });

        if (disposed) stop();
        else unlisten = stop;
      } catch (error) {
        // Never let this become an unhandled rejection: failing to arrange a
        // backup is not a reason to take the app down with it.
        logWarn('[Backup] Could not listen for the window closing:', error);
      }
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}
