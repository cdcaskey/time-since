import { describe, expect, it } from 'vitest';
import {
  DURATION_UNITS,
  formatElapsed,
  fromSeconds,
  secondsToUnitValue,
  SECONDS_PER_UNIT,
  toSeconds,
} from './duration.js';

describe('unit conversion', () => {
  it('uses fixed-length weeks and months, not calendar arithmetic', () => {
    expect(SECONDS_PER_UNIT.weeks).toBe(7 * 24 * 60 * 60);
    expect(SECONDS_PER_UNIT.months).toBe(30 * 24 * 60 * 60);
  });

  it.each<[number, import('./duration.js').DurationUnit, number]>([
    [1, 'minutes', 60],
    [90, 'minutes', 5400],
    [1, 'hours', 3600],
    [1, 'days', 86400],
    [2, 'weeks', 1209600],
    [3, 'months', 7776000],
  ])('%d %s -> %d seconds', (value, unit, expectedSeconds) => {
    expect(toSeconds(value, unit)).toBe(expectedSeconds);
  });

  it('round-trips value -> seconds -> value for every unit', () => {
    for (const unit of DURATION_UNITS) {
      const seconds = toSeconds(5, unit);
      expect(fromSeconds(seconds, unit)).toBeCloseTo(5, 9);
    }
  });

  it('round-trips seconds -> value -> seconds for exact multiples of every unit', () => {
    for (const unit of DURATION_UNITS) {
      const seconds = SECONDS_PER_UNIT[unit] * 3;
      const value = fromSeconds(seconds, unit);
      expect(toSeconds(value, unit)).toBe(seconds);
    }
  });
});

describe('secondsToUnitValue', () => {
  it('picks the largest unit that divides evenly', () => {
    expect(secondsToUnitValue(toSeconds(2, 'weeks'))).toEqual({ value: 2, unit: 'weeks' });
    expect(secondsToUnitValue(toSeconds(3, 'months'))).toEqual({ value: 3, unit: 'months' });
    expect(secondsToUnitValue(toSeconds(90, 'minutes'))).toEqual({ value: 90, unit: 'minutes' });
  });

  it('does not report a fractional value in a larger unit', () => {
    // 90 minutes is 1.5 hours — hours would be wrong (fractional), so this
    // must fall through to minutes, which divides evenly.
    expect(secondsToUnitValue(5400)).toEqual({ value: 90, unit: 'minutes' });
  });

  it('falls back to fractional minutes when nothing divides evenly', () => {
    expect(secondsToUnitValue(90)).toEqual({ value: 1.5, unit: 'minutes' });
  });
});

describe('formatElapsed', () => {
  it.each<[number, string]>([
    [0, 'just now'],
    [59, 'just now'],
    [60, '1 minute ago'],
    [61, '1 minute ago'],
    [119, '1 minute ago'],
    [120, '2 minutes ago'],
    [3599, '59 minutes ago'],
    [3600, '1 hour ago'],
    [7199, '1 hour ago'],
    [7200, '2 hours ago'],
    [86399, '23 hours ago'],
    [86400, '1 day ago'],
    [2 * 86400, '2 days ago'],
    [7 * 86400, '1 week ago'],
    [30 * 86400, '1 month ago'],
    [365 * 86400, '1 year ago'],
  ])('%d seconds -> %s', (seconds, expected) => {
    expect(formatElapsed(seconds)).toBe(expected);
  });
});
