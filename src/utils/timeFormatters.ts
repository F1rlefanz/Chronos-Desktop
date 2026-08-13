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
 * Formats duration into human readable string (e.g., "1h 24m 12s").
 */
export function formatDurationHuman(totalMs: number): string {
  const { hours, minutes, seconds } = parseMsToComponents(totalMs);
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

/**
 * Formats timestamp to localized date & time string.
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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

/**
 * Formats timestamp to simple date string.
 */
export function formatDateOnly(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
