/**
 * What this installation calls itself in the shared folder.
 *
 * Its own module, without imports, because it is read from two directions that
 * must not depend on each other: storage generates and keeps it, and syncing
 * turns it into a file name.
 *
 * Hex, so it is a valid file name everywhere without escaping. Twelve
 * characters is enough that two of a person's own devices will not collide, and
 * it is deliberately not a device *name* — nothing identifying anyone goes into
 * a folder that may well be a shared drive.
 */
const DEVICE_ID_PATTERN = /^[0-9a-f]{8,32}$/;

export function newDeviceId(): string {
  const bytes = new Uint8Array(6);

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    // No Web Crypto (a very old WebView): this id has to be unique among a
    // handful of the user's own devices, not unguessable.
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }

  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isDeviceId(value: unknown): value is string {
  return typeof value === 'string' && DEVICE_ID_PATTERN.test(value);
}
