import { describe, expect, it } from 'vitest';
import type { TaskDto } from '@shared/types';
import { BAND_ORDER, filterTasks, groupByBand, rankTasks } from './taskRanking';

const NOW = 1_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function makeTask(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: crypto.randomUUID(),
    name: 'Task',
    description: '',
    dueAfterSeconds: 86400,
    overdueAfterSeconds: 172800,
    urgentAfterSeconds: 345600,
    createdAt: NOW - 10 * DAY,
    updatedAt: NOW - 10 * DAY,
    lastCompletedAt: null,
    completionCount: 0,
    ...overrides,
  };
}

describe('rankTasks', () => {
  it('anchors a never-completed task on createdAt', () => {
    const task = makeTask({ createdAt: NOW - 1000 * 1000, lastCompletedAt: null });
    const [ranked] = rankTasks([task], NOW);
    expect(ranked.score).toBeGreaterThan(0);
  });

  it('anchors a completed task on lastCompletedAt, not createdAt', () => {
    const task = makeTask({ createdAt: NOW - 100 * DAY, lastCompletedAt: NOW - 1000 });
    const [ranked] = rankTasks([task], NOW);
    expect(ranked.score).toBeCloseTo(0, 2);
  });

  it('sorts by score descending, then name ascending for ties', () => {
    const high = makeTask({ name: 'B', lastCompletedAt: NOW - 10 * DAY });
    const tieA = makeTask({ name: 'Zebra', lastCompletedAt: NOW - 1000, dueAfterSeconds: 100 });
    const tieB = makeTask({ name: 'Apple', lastCompletedAt: NOW - 1000, dueAfterSeconds: 100 });

    const ranked = rankTasks([high, tieA, tieB], NOW);
    expect(ranked.map((r) => r.task.name)).toEqual(['B', 'Apple', 'Zebra']);
  });
});

describe('groupByBand', () => {
  it('buckets every ranked task under its band', () => {
    const urgent = makeTask({ name: 'U', lastCompletedAt: NOW - 100 * DAY });
    const ok = makeTask({ name: 'O', lastCompletedAt: NOW });

    const groups = groupByBand(rankTasks([urgent, ok], NOW));

    expect(groups.urgent.map((r) => r.task.name)).toEqual(['U']);
    expect(groups.ok.map((r) => r.task.name)).toEqual(['O']);
    expect(groups.due).toEqual([]);
    expect(groups.overdue).toEqual([]);
  });

  it('BAND_ORDER lists every band from most to least urgent', () => {
    expect(BAND_ORDER).toEqual(['urgent', 'overdue', 'due', 'ok']);
  });
});

describe('filterTasks', () => {
  const tasks = [
    makeTask({ name: 'Clean gutters', description: 'front and back' }),
    makeTask({ name: 'Water plants', description: 'especially the ferns' }),
  ];

  it('returns everything for a blank query', () => {
    expect(filterTasks(tasks, '   ')).toEqual(tasks);
  });

  it('matches on name, case-insensitively', () => {
    expect(filterTasks(tasks, 'GUTTERS')).toEqual([tasks[0]]);
  });

  it('matches on description', () => {
    expect(filterTasks(tasks, 'ferns')).toEqual([tasks[1]]);
  });

  it('returns nothing when no task matches', () => {
    expect(filterTasks(tasks, 'nonexistent')).toEqual([]);
  });
});
