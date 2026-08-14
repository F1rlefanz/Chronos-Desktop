import { useEffect, useRef } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { backupsAvailable, writeBackup } from '../utils/storage';
import { flushLogs, logInfo, logWarn } from '../utils/logging/logger';

/** A hung snapshot must never leave the user unable to close the window. */
const CLOSE_TIMEOUT_MS = 3000;

/** Neither a snapshot nor a sync may hold the window open indefinitely. */
async function withinTimeout<T>(work: Promise<T>, label: string): Promise<T | null> {
  const result = await Promise.race([
    work,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), CLOSE_TIMEOUT_MS)),
  ]);

  if (result === null) logWarn(`[Close] ${label} timed out; closing anyway.`);
  return result;
}

/**
 * Takes a snapshot as the window closes — and hands the day's work on.
 *
 * The daily snapshot is taken at startup, over the state it *finds* — so a
 * day's work is in no snapshot at all until the next launch. Closing the window
 * is the moment that work is finished, which makes it the natural second one.
 *
 * A background service was the alternative and would have been the wrong tool:
 * the data can only change through this app, so a service running while it is
 * closed would keep copying a file that cannot have changed.
 *
 * `alsoRun` is the other half of that argument: it is where the shared folder
 * is written, for exactly the same reason. Both race their own timeout, because
 * a window that will not close is worse than a missing backup — and a folder on
 * a network drive is precisely the kind of thing that can hang.
 */
export function useBackupOnClose(buildContents: () => string, alsoRun?: () => Promise<void>): void {
  // Kept in a ref so the listener is attached once but always snapshots the
  // current state rather than whatever existed when it was registered. Updated
  // in an effect rather than during render, which React forbids for refs.
  const buildRef = useRef(buildContents);
  const alsoRef = useRef(alsoRun);

  useEffect(() => {
    buildRef.current = buildContents;
    alsoRef.current = alsoRun;
  }, [buildContents, alsoRun]);

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
            const result = await withinTimeout(
              writeBackup('on-close', buildRef.current()),
              'Closing snapshot'
            );

            if (result !== null) {
              if (result.ok) logInfo('[Backup] Closing snapshot written.');
              else logWarn(`[Backup] Closing snapshot failed: ${result.message}`);
            }
          } catch (error) {
            logWarn('[Backup] Closing snapshot failed:', error);
          }

          // After the snapshot, not before: the local copy is the one that must
          // exist, and it must not lose its slot to a slow shared folder.
          if (alsoRef.current) {
            try {
              await withinTimeout(alsoRef.current(), 'Closing sync');
            } catch (error) {
              logWarn('[Sync] Writing to the shared folder on close failed:', error);
            }
          }

          // The log writes are chained and asynchronous, so without this the
          // process exits first and the very last line — the one that says
          // whether the closing snapshot worked — never reaches the file. That
          // is precisely the line someone goes looking for.
          await flushLogs();
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
