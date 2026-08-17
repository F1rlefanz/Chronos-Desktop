import { invoke, isTauri } from '@tauri-apps/api/core';
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

/**
 * Whether this build can open a socket at all.
 *
 * Deliberately not `syncAvailable()`, which answers a different question: that
 * one is about a transport for the *folder*, and a build could plausibly gain
 * one without gaining the other. Both Tauri builds carry `lan.rs` — the phone
 * as much as the desktop, because `std::net` needs no picker and no permission
 * beyond the `INTERNET` one that was already in the manifest. A browser has
 * neither, so the door is not drawn there.
 */
export function lanAvailable(): boolean {
  return isTauri();
}

/**
 * The port the listener asks for first, and the one the other side assumes when
 * only an address was typed. Written once here and read by both halves — the
 * dialog would otherwise carry a second copy that could drift from the Rust.
 */
export const DEFAULT_PORT = 45888;

/** Where the other device has to point, and what to type there. */
export interface Listening {
  address: string;
  port: number;
  code: string;
}

/**
 * What someone typed, as an address and a port — or nothing.
 *
 * `192.168.178.43` and `192.168.178.43:49152` are both things people read off
 * a screen, and the second one appears whenever the preferred port was taken.
 * Anything else is refused here rather than sent to Rust to fail there, so the
 * message names what is wrong with the input instead of the connection.
 */
export function parseTarget(input: string): { address: string; port: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':');
  if (parts.length > 2) return null;

  const [address, port] = parts;
  if (!address) return null;

  const parsed = port === undefined ? DEFAULT_PORT : Number(port);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) return null;

  return { address, port: parsed };
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
 * What the last ask brought back.
 *
 * `exhausted` is not a kind of "nothing arrived", which is why it is a second
 * field rather than a special payload: a listener that gave up after ten wrong
 * codes is silent in exactly the same way as one nobody has tried yet, and a
 * dialog that cannot tell them apart goes on showing an address that no longer
 * answers.
 */
export interface Incoming {
  payload: string | null;
  exhausted: boolean;
}

/**
 * What a peer sent us since the last ask, if anything.
 *
 * Polled while the dialog is open rather than pushed as an event: the exchange
 * only happens during those few seconds, and a listener that outlives the
 * dialog is a listener somebody has to remember to remove.
 */
export function takeReceived(): Promise<Incoming> {
  return invoke<Incoming>('lan_received');
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
