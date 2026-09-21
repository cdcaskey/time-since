import { describe, expect, it } from 'vitest';
import { bandForScore, urgencyScore, type Band, type UrgencyInput } from './urgency.js';

const SECOND = 1000;
const NOW = 1_000_000 * SECOND;

function scoreFor(
  elapsedSeconds: number,
  thresholds: { due: number; overdue: number; urgent: number },
): number {
  const input: UrgencyInput = {
    anchorAt: NOW - elapsedSeconds * SECOND,
    dueAfterSeconds: thresholds.due,
    overdueAfterSeconds: thresholds.overdue,
    urgentAfterSeconds: thresholds.urgent,
    now: NOW,
  };
  return urgencyScore(input);
}

describe('urgencyScore', () => {
  const thresholds = { due: 100, overdue: 200, urgent: 400 };

  it.each<[string, number, number]>([
    ['elapsed is exactly zero', 0, 0],
    ['elapsed is negative (anchor in the future)', -50, 0],
    ['elapsed is well before dueAfter', 50, 0.5],
    ['elapsed is one second before dueAfter', 99, 0.99],
    ['elapsed equals dueAfter (due boundary)', 100, 1],
    ['elapsed is midway between due and overdue', 150, 1.5],
    ['elapsed is one second before overdueAfter', 199, 1.99],
    ['elapsed equals overdueAfter (overdue boundary)', 200, 2],
    ['elapsed is midway between overdue and urgent', 300, 2.5],
    ['elapsed is one second before urgentAfter', 399, 2.995],
    ['elapsed equals urgentAfter (urgent boundary)', 400, 3],
    ['elapsed is one urgent-band-width past urgentAfter', 600, 4],
    ['elapsed is far past urgentAfter', 1000, 6],
  ])('%s -> %f', (_label, elapsedSeconds, expectedScore) => {
    expect(scoreFor(elapsedSeconds, thresholds)).toBeCloseTo(expectedScore, 6);
  });
});

describe('bandForScore', () => {
  it.each<[number, Band]>([
    [0, 'ok'],
    [0.5, 'ok'],
    [0.999, 'ok'],
    [1, 'due'],
    [1.5, 'due'],
    [1.999, 'due'],
    [2, 'overdue'],
    [2.5, 'overdue'],
    [2.999, 'overdue'],
    [3, 'urgent'],
    [10, 'urgent'],
  ])('score %f -> %s', (score, expected) => {
    expect(bandForScore(score)).toBe(expected);
  });
});

describe('a daily task two days late outranks an annual task six months early', () => {
  const day = 24 * 60 * 60;

  const daily = { due: day, overdue: 2 * day, urgent: 4 * day };
  const annual = { due: 365 * day, overdue: 400 * day, urgent: 450 * day };

  it('scores the worked example from the spec', () => {
    expect(scoreFor(2 * day, daily)).toBeCloseTo(2.0, 2);
    expect(scoreFor(180 * day, annual)).toBeCloseTo(0.49, 2);
    expect(scoreFor(420 * day, annual)).toBeCloseTo(2.4, 2);
  });

  it('sorts the annual task at 420 days above the daily task at 2 days, both above the annual task at 180 days', () => {
    const tasks = [
      { name: 'daily-2d', score: scoreFor(2 * day, daily) },
      { name: 'annual-180d', score: scoreFor(180 * day, annual) },
      { name: 'annual-420d', score: scoreFor(420 * day, annual) },
    ].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    expect(tasks.map((t) => t.name)).toEqual(['annual-420d', 'daily-2d', 'annual-180d']);
  });
});
