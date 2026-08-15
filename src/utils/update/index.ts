import { logInfo, logWarn } from '../logging/logger';
import { AvailableUpdate, UpdateChannel } from './types';

export type { AvailableUpdate, UpdateChannel } from './types';

let channel: UpdateChannel | null = null;

/** Installed by `main.tsx` for the builds that have one; the browser has none. */
export function setUpdateChannel(next: UpdateChannel | null): void {
  channel = next;
}

/** Whether this build can update itself at all — the banner is hidden if not. */
export function updatesAvailable(): boolean {
  return channel !== null;
}

/**
 * Asks whether there is a newer version, swallowing the ordinary failures.
 *
 * An update check is the one piece of work here nobody asked for: it runs on
 * its own at startup. A laptop opened on a train has no network and that is not
 * an error worth a banner, so everything short of a real answer comes back as
 * `null` and goes to the log instead. The user finds out there is an update
 * when there is one, and otherwise never hears about the mechanism.
 */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!channel) return null;

  try {
    const found = await channel.check();
    logInfo(found ? `[Update] ${found.version} is available.` : '[Update] Already current.');
    return found;
  } catch (error) {
    logWarn('[Update] Could not check for updates:', error);
    return null;
  }
}

/**
 * Compares two `major.minor.patch` strings.
 *
 * Deliberately not a dependency and deliberately not `localeCompare`: `1.10.0`
 * sorts before `1.9.0` as text, which is the whole class of bug this exists to
 * avoid. Anything that is not three numbers is treated as older than something
 * that is, so a malformed manifest cannot advertise itself as an upgrade.
 */
export function isNewer(candidate: string, current: string): boolean {
  const parts = (value: string): number[] | null => {
    const trimmed = value.trim().replace(/^v/, '');
    const bits = trimmed.split('.');
    if (bits.length !== 3) return null;

    const numbers = bits.map((bit) => Number(bit));
    return numbers.every((n) => Number.isInteger(n) && n >= 0) ? numbers : null;
  };

  const a = parts(candidate);
  const b = parts(current);
  if (!a || !b) return false;

  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
