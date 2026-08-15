import { invoke } from '@tauri-apps/api/core';
import { logInfo, logWarn } from '../logging/logger';

/**
 * Two devices on the same network, talking to each other directly.
 *
 * The shared folder is the patient way to sync: it works between devices that
 * are never awake at the same time, and it needs something else to carry the
 * files. This is the impatient way, for the case that folder cannot cover
 * without a third program — both devices here, both on, both open.
 *
 * Everything below the surface is the same as the folder: the same payload
 * built by `buildSyncPayload`, read by `parseSyncPayload`, reconciled by
 * `mergeEntries`. Only the transport differs, which is the whole reason that
 * seam exists.
 */

/** Where the other device has to point, and what to type there. */
export interface Listening {
  address: string;
  port: number;
  code: string;
}

/**
 * Six digits, read off one screen and typed into the other.
 *
 * Not a password and not pretending to be one: it keeps a neighbour who is
 * already on your WiFi from pushing their hours into your app by accident or
 * for fun, for the minute or two the dialog is open.
 */
export function newPairingCode(): string {
  const digits = new Uint32Array(1);

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(digits);
  } else {
    digits[0] = Math.floor(Math.random() * 1_000_000);
  }

  return String(digits[0] % 1_000_000).padStart(6, '0');
}

/** Starts answering on this device, and says where to reach it. */
export async function startListening(code: string, payload: string): Promise<Listening> {
  const where = await invoke<{ address: string; port: number }>('lan_start', { code, payload });
  logInfo(`[LAN] Listening on ${where.address}:${where.port}.`);
  return { ...where, code };
}

export async function stopListening(): Promise<void> {
  try {
    await invoke('lan_stop');
  } catch (error) {
    // Nothing the user can do about it, and the listener dies with the app.
    logWarn('[LAN] Could not stop listening:', error);
  }
}

/**
 * What a peer sent us since the last ask, if anything.
 *
 * Polled while the dialog is open rather than pushed as an event: the exchange
 * only happens during those few seconds, and a listener that outlives the
 * dialog is a listener somebody has to remember to remove.
 */
export function takeReceived(): Promise<string | null> {
  return invoke<string | null>('lan_received');
}

/** The other half: hand ours over, take theirs. */
export function exchange(
  address: string,
  port: number,
  code: string,
  payload: string
): Promise<string> {
  return invoke<string>('lan_exchange', { address, port, code, payload });
}
