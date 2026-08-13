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
  it('rounds down to whole minutes', () => {
    // Seconds are noise in a record of worked time; the live readout is where
    // second-by-second precision belongs.
    expect(formatDurationHuman(125_000)).toBe('2 Min.');
  });

  it('says so rather than rounding a short break down to nothing', () => {
    expect(formatDurationHuman(9_000)).toBe('unter 1 Min.');
  });

  it('distinguishes no time at all from a very short time', () => {
    expect(formatDurationHuman(0)).toBe('0 Min.');
  });

  it('keeps a zero minutes segment when hours are present', () => {
    expect(formatDurationHuman(3_605_000)).toBe('1 Std. 0 Min.');
  });

  it('formats hours and minutes together', () => {
    expect(formatDurationHuman(2 * 3_600_000 + 35 * 60_000)).toBe('2 Std. 35 Min.');
  });

  it('never reports a negative duration', () => {
    expect(formatDurationHuman(-5_000)).toBe('0 Min.');
  });
});
