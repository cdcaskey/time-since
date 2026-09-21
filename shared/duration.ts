export type DurationUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

// Fixed-length conversions, not calendar arithmetic: a week is always 7
// days and a month is always 30 days. Nothing else in the app converts
// units — this is the one place.
export const SECONDS_PER_UNIT: Record<DurationUnit, number> = {
  minutes: 60,
  hours: 60 * 60,
  days: 24 * 60 * 60,
  weeks: 7 * 24 * 60 * 60,
  months: 30 * 24 * 60 * 60,
};

export const DURATION_UNITS: DurationUnit[] = ['minutes', 'hours', 'days', 'weeks', 'months'];

export function toSeconds(value: number, unit: DurationUnit): number {
  return Math.round(value * SECONDS_PER_UNIT[unit]);
}

export function fromSeconds(seconds: number, unit: DurationUnit): number {
  return seconds / SECONDS_PER_UNIT[unit];
}

const ELAPSED_UNITS: { label: string; seconds: number }[] = [
  { label: 'year', seconds: 365 * 24 * 60 * 60 },
  { label: 'month', seconds: 30 * 24 * 60 * 60 },
  { label: 'week', seconds: 7 * 24 * 60 * 60 },
  { label: 'day', seconds: 24 * 60 * 60 },
  { label: 'hour', seconds: 60 * 60 },
  { label: 'minute', seconds: 60 },
];

// Human-readable "time since" for card display, e.g. "3 days ago". Elapsed
// time under a minute collapses to "just now" — sub-minute precision isn't
// meaningful for tasks whose cadence is measured in days to months.
export function formatElapsed(seconds: number): string {
  if (seconds < 60) return 'just now';

  for (const { label, seconds: unitSeconds } of ELAPSED_UNITS) {
    if (seconds >= unitSeconds) {
      const count = Math.floor(seconds / unitSeconds);
      return `${count} ${label}${count === 1 ? '' : 's'} ago`;
    }
  }

  return 'just now';
}
