/**
 * Whether this build runs on a phone.
 *
 * Read from the user agent rather than through a plugin: the one thing the app
 * needs to know is whether "show me that folder in a file manager" is a
 * sentence that means anything here, and on Android and iOS it is not. A
 * dependency for a single boolean would be a poor trade.
 *
 * Deliberately not used to decide anything about *storage* — the phone stores
 * and backs up exactly like the desktop. It only hides doors that lead nowhere.
 */
export function isMobilePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
