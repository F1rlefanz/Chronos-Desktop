import { describe, it, expect } from 'vitest';
import { parseMsToComponents, formatTimeDisplay, formatDurationHuman } from './timeFormatters';

describe('parseMsToComponents', () => {
  it('splits a duration into its parts', () => {
    // 1h 23m 45s 678ms
    const ms = 1 * 3600_000 + 23 * 60_000 + 45 * 1000 + 678;
    expect(parseMsToComponents(ms)).toEqual({
      hours: 1,
      minutes: 23,
      seconds: 45,
      milliseconds: 678,
      hundredths: 67,
    });
  });

  it('returns zeroes for zero', () => {
    expect(parseMsToComponents(0)).toEqual({
      hours: 0,
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
      hundredths: 0,
    });
  });

  it('clamps negative input to zero rather than producing negative parts', () => {
    expect(parseMsToComponents(-5000)).toEqual({
      hours: 0,
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
      hundredths: 0,
    });
  });

  it('rolls over exactly at the hour boundary', () => {
    expect(parseMsToComponents(3600_000)).toMatchObject({ hours: 1, minutes: 0, seconds: 0 });
    expect(parseMsToComponents(3599_999)).toMatchObject({ hours: 0, minutes: 59, seconds: 59 });
  });
});

describe('formatTimeDisplay', () => {
  it('omits hours below one hour', () => {
    expect(formatTimeDisplay(65_000)).toEqual({ mainTime: '01:05', subTime: '' });
  });

  it('includes hours once they are reached', () => {
    expect(formatTimeDisplay(3_665_000)).toEqual({ mainTime: '01:01:05', subTime: '' });
  });

  it('forces hours when asked', () => {
    expect(formatTimeDisplay(65_000, { alwaysShowHours: true })).toEqual({
      mainTime: '00:01:05',
      subTime: '',
    });
  });

  it('renders hundredths, zero-padded, when milliseconds are requested', () => {
    expect(formatTimeDisplay(1_050, { includeMilliseconds: true })).toEqual({
      mainTime: '00:01',
      subTime: '.05',
    });
  });
});

describe('formatDurationHuman', () => {
  it('shows seconds only for short durations', () => {
    expect(formatDurationHuman(9_000)).toBe('9s');
  });

  it('adds minutes once they exist', () => {
    expect(formatDurationHuman(125_000)).toBe('2m 5s');
  });

  it('keeps a zero minutes segment when hours are present', () => {
    expect(formatDurationHuman(3_605_000)).toBe('1h 0m 5s');
  });
});
