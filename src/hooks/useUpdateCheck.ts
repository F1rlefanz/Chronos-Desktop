import { useCallback, useEffect, useRef, useState } from 'react';
import { AvailableUpdate, checkForUpdate, updatesAvailable } from '../utils/update';

/**
 * How long the app waits before asking again while it stays open.
 *
 * Six hours is a compromise with one honest side: a release cannot reach a
 * running copy the moment it is published, because nothing pushes to this app —
 * there is no server and no account, which is the point of it. Asking on a
 * rhythm is what a program with no one to tell it can do, and six hours means
 * someone who leaves Chronos open all week still hears about a release the same
 * day rather than at the next restart.
 */
const EVERY = 6 * 60 * 60 * 1000;

/**
 * The shortest gap between two checks caused by coming back to the window.
 *
 * Without it, alt-tabbing would ask on every switch. An hour is far below the
 * interval and far above the rate at which anyone changes windows.
 */
const NOT_MORE_OFTEN_THAN = 60 * 60 * 1000;

export interface UpdateCheck {
  /** The newer version on offer, or `null` — including when it was dismissed. */
  update: AvailableUpdate | null;
  /** Hides this version's banner. A later version brings its own. */
  dismiss: () => void;
}

/**
 * Watches for a newer version: at startup, on a slow rhythm, and on returning.
 *
 * The rhythm alone is not enough. A laptop that was asleep runs no timers, so
 * the copy someone opens on Monday would go on believing what it learned on
 * Friday; coming back to the window is the moment that catches it. Both are
 * cheap — one small file over HTTPS — and both go through `checkForUpdate`,
 * which swallows the ordinary failures rather than turning a train journey
 * without signal into something the user has to read.
 *
 * Dismissal is remembered **by version**, not for the session. With one check
 * at startup those were the same thing; with several they are not, and the
 * cost of getting it wrong is that dismissing 1.2.0 would silently hide 1.3.0
 * as well.
 */
export function useUpdateCheck(): UpdateCheck {
  const [found, setFound] = useState<AvailableUpdate | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const lastCheckedRef = useRef(0);

  // The answer is set from the promise's callback rather than after an `await`.
  // Both are asynchronous, but only the callback form reads as such to
  // `react-hooks/set-state-in-effect` — and the rule is right in general: this
  // is a subscription to something outside React, not state derived in render.
  const look = useCallback(() => {
    lastCheckedRef.current = Date.now();
    void checkForUpdate().then(setFound);
  }, []);

  useEffect(() => {
    if (!updatesAvailable()) return;

    look();
    const timer = setInterval(look, EVERY);

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastCheckedRef.current < NOT_MORE_OFTEN_THAN) return;
      look();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [look]);

  const dismiss = useCallback(() => {
    setDismissedVersion(found?.version ?? null);
  }, [found]);

  return {
    update: found && found.version !== dismissedVersion ? found : null,
    dismiss,
  };
}
