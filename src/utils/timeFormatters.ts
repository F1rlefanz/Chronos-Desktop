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
 * Formats timestamp to simple date string.
 */
export function formatDateOnly(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
