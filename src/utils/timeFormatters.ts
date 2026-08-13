import { TIME_CONSTANTS } from '../constants/defaultConfig';

/**
 * Interface representing broken down time components.
 */
export interface TimeComponents {
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  hundredths: number;
}

/**
 * Converts total milliseconds into structured time components.
 */
export function parseMsToComponents(totalMs: number): TimeComponents {
  const safeMs = Math.max(0, Math.floor(totalMs));

  const hours = Math.floor(safeMs / TIME_CONSTANTS.MS_PER_HOUR);
  const remainingAfterHours = safeMs % TIME_CONSTANTS.MS_PER_HOUR;

  const minutes = Math.floor(remainingAfterHours / TIME_CONSTANTS.MS_PER_MINUTE);
  const remainingAfterMinutes = remainingAfterHours % TIME_CONSTANTS.MS_PER_MINUTE;

  const seconds = Math.floor(remainingAfterMinutes / TIME_CONSTANTS.MS_PER_SECOND);
  const milliseconds = remainingAfterMinutes % TIME_CONSTANTS.MS_PER_SECOND;
  const hundredths = Math.floor(milliseconds / 10);

  return {
    hours,
    minutes,
    seconds,
    milliseconds,
    hundredths,
  };
}

/**
 * Formats time components into standard string representation HH:MM:SS or MM:SS.
 */
export function formatTimeDisplay(
  totalMs: number,
  options: { includeMilliseconds?: boolean; alwaysShowHours?: boolean } = {}
): { mainTime: string; subTime: string } {
  const { hours, minutes, seconds, hundredths } = parseMsToComponents(totalMs);

  const pad = (num: number, digits: number = 2) => String(num).padStart(digits, '0');

  const formattedHours = pad(hours);
  const formattedMinutes = pad(minutes);
  const formattedSeconds = pad(seconds);
  const formattedHundredths = pad(hundredths);

  const mainTime =
    hours > 0 || options.alwaysShowHours
      ? `${formattedHours}:${formattedMinutes}:${formattedSeconds}`
      : `${formattedMinutes}:${formattedSeconds}`;

  const subTime = options.includeMilliseconds ? `.${formattedHundredths}` : '';

  return { mainTime, subTime };
}

/**
 * A duration in words, e.g. "1 Std. 24 Min.".
 *
 * Rounded to the minute: seconds are noise in a record of worked time, and a
 * timesheet that reads "2 Std. 35 Min. 12 Sek." is harder to scan for no gain.
 * Anything under a minute says so rather than rounding down to nothing, so a
 * short break never looks like no break at all.
 */
export function formatDurationHuman(totalMs: number): string {
  const totalMinutes = Math.floor(Math.max(0, totalMs) / TIME_CONSTANTS.MS_PER_MINUTE);

  if (totalMinutes === 0) {
    return totalMs > 0 ? 'unter 1 Min.' : '0 Min.';
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} Min.`;
  return `${hours} Std. ${minutes} Min.`;
}

/**
 * The one place the app's locale is decided.
 *
 * Fixed rather than following the host: the interface is written in German
 * throughout, and a date rendered as "1/15/2026" next to a label reading
 * "Zeitraum" is worse than one that simply matches.
 */
const LOCALE = 'de-DE';

/** Date and time, e.g. "15.01.2026, 09:30". */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Time of day alone, e.g. "09:30". */
export function formatTimeOfDay(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a timestamp for an `<input type="datetime-local">`.
 *
 * Local time on purpose: `toISOString` would shift the value into UTC and show
 * the user a different hour than the one they recorded. Because the control
 * carries a full date, a stretch of work from 22:00 to 01:00 is expressed as
 * two ordinary timestamps — there is no single "date of the entry" that both
 * ends have to squeeze into, which is what makes an entry over midnight
 * editable at all.
 */
export function toDateTimeInputValue(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Reads such an input back. `NaN` when the field is empty or half-typed. */
export function fromDateTimeInputValue(value: string): number {
  return new Date(value).getTime();
}

/** Date alone, e.g. "15.01.2026". */
export function formatDateOnly(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
