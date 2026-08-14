import { useEffect } from 'react';

/**
 * How many locks are currently held.
 *
 * Modals can overlap — the export dialog can open over the settings dialog —
 * and a per-modal cleanup would release the lock as soon as the *first* one
 * closed, letting the page scroll behind the one still open. Counting means
 * the page is only released when the last lock goes.
 */
let holders = 0;
let restoreOverflow = '';

/**
 * Stops the page behind a modal from scrolling while it is open.
 *
 * Without this, scrolling inside a dialog reaches its end and carries on
 * scrolling the app behind it, and a scroll that starts over the dimmed
 * backdrop moves the page directly.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    if (holders === 0) {
      restoreOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    holders += 1;

    return () => {
      holders -= 1;
      if (holders === 0) {
        document.body.style.overflow = restoreOverflow;
      }
    };
  }, [active]);
}
