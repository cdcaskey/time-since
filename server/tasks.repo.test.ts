import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { faker } from '@faker-js/faker';
import type { CreateTaskParams } from './tasks.repo.js';

// Same isolation pattern as app.test.ts: DATA_DIR is read at import time by
// db.ts, so it must be set before tasks.repo.ts (and its transitive db.ts
// import) are loaded — dynamically, after the env var is in place.
let dataDir: string;
let repo: typeof import('./tasks.repo.js');
let db: typeof import('./db.js').db;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'time-since-repo-test-'));
  process.env.DATA_DIR = dataDir;

  const { runMigrations } = await import('./migrate.js');
  ({ db } = await import('./db.js'));
  repo = await import('./tasks.repo.js');

  runMigrations();
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  db.exec('DELETE FROM completions; DELETE FROM tasks;');
});

function makeTaskParams(overrides: Partial<CreateTaskParams> = {}): CreateTaskParams {
  return {
    name: faker.commerce.productName(),
    description: '',
    dueAfterSeconds: 100,
    overdueAfterSeconds: 200,
    urgentAfterSeconds: 400,
    ...overrides,
  };
}

describe('createTask / getTask', () => {
  it('creates a task with no completions', () => {
    const created = repo.createTask(makeTaskParams({ name: 'Clean gutters' }));

    expect(created.name).toBe('Clean gutters');
    expect(created.lastCompletedAt).toBeNull();
    expect(created.initialState).toBeNull();
    expect(created.completionCount).toBe(0);
    expect(created.createdAt).toBe(created.updatedAt);

    const fetched = repo.getTask(created.id);
    expect(fetched).toEqual(created);
  });

  it('stores an initialState override', () => {
    const created = repo.createTask(makeTaskParams({ initialState: 'due' }));
    expect(created.initialState).toBe('due');
  });

  it('returns undefined for an unknown id', () => {
    expect(repo.getTask(crypto.randomUUID())).toBeUndefined();
  });

  it('rejects thresholds that do not strictly increase via the CHECK constraints', () => {
    expect(() =>
      repo.createTask(makeTaskParams({ dueAfterSeconds: 100, overdueAfterSeconds: 100 })),
    ).toThrow();
  });
});

describe('listTasks', () => {
  it('returns an empty list when there are no tasks', () => {
    expect(repo.listTasks()).toEqual([]);
  });

  it('assembles last-completion data for every task in a bounded number of queries', () => {
    const withCompletions = repo.createTask(makeTaskParams({ name: 'A' }));
    const withoutCompletions = repo.createTask(makeTaskParams({ name: 'B' }));

    repo.createCompletion({ id: crypto.randomUUID(), taskId: withCompletions.id });
    repo.createCompletion({ id: crypto.randomUUID(), taskId: withCompletions.id });

    const tasks = repo.listTasks();
    const a = tasks.find((t) => t.id === withCompletions.id)!;
    const b = tasks.find((t) => t.id === withoutCompletions.id)!;

    expect(a.completionCount).toBe(2);
    expect(a.lastCompletedAt).not.toBeNull();
    expect(b.completionCount).toBe(0);
    expect(b.lastCompletedAt).toBeNull();
  });
});

describe('updateTask', () => {
  it('updates only the given fields and bumps updated_at', async () => {
    const created = repo.createTask(makeTaskParams({ name: 'Original' }));

    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = repo.updateTask(created.id, { name: 'Renamed' });

    expect(updated?.name).toBe('Renamed');
    expect(updated?.dueAfterSeconds).toBe(created.dueAfterSeconds);
    expect(updated!.updatedAt).toBeGreaterThan(created.updatedAt);
    expect(updated?.createdAt).toBe(created.createdAt);
  });

  it('returns undefined for an unknown id', () => {
    expect(repo.updateTask(crypto.randomUUID(), { name: 'X' })).toBeUndefined();
  });

  it('rejects an update that breaks strictly-increasing thresholds', () => {
    const created = repo.createTask(makeTaskParams());
    expect(() => repo.updateTask(created.id, { overdueAfterSeconds: 50 })).toThrow();
  });
});

describe('deleteTask', () => {
  it('cascades to delete the task’s completions', () => {
    const task = repo.createTask(makeTaskParams());
    const completion = repo.createCompletion({ id: crypto.randomUUID(), taskId: task.id });

    expect(repo.deleteTask(task.id)).toBe(true);
    expect(repo.getTask(task.id)).toBeUndefined();

    const remaining = db.prepare('SELECT * FROM completions WHERE id = ?').get(completion.id);
    expect(remaining).toBeUndefined();
  });

  it('returns false for an unknown id', () => {
    expect(repo.deleteTask(crypto.randomUUID())).toBe(false);
  });
});

describe('completions', () => {
  it('reports MAX(completed_at) correctly when rows are inserted out of order', () => {
    const task = repo.createTask(makeTaskParams());

    const early = repo.createCompletion({ id: crypto.randomUUID(), taskId: task.id });
    db.prepare('UPDATE completions SET completed_at = ? WHERE id = ?').run(1000, early.id);

    const late = repo.createCompletion({ id: crypto.randomUUID(), taskId: task.id });
    db.prepare('UPDATE completions SET completed_at = ? WHERE id = ?').run(2_000_000, late.id);

    const middle = repo.createCompletion({ id: crypto.randomUUID(), taskId: task.id });
    db.prepare('UPDATE completions SET completed_at = ? WHERE id = ?').run(500_000, middle.id);

    const fetched = repo.getTask(task.id)!;
    expect(fetched.lastCompletedAt).toBe(2_000_000);
    expect(fetched.completionCount).toBe(3);
  });

  it('falls back to the next-most-recent completion after the latest is deleted', () => {
    const task = repo.createTask(makeTaskParams());

    const first = repo.createCompletion({ id: crypto.randomUUID(), taskId: task.id });
    db.prepare('UPDATE completions SET completed_at = ? WHERE id = ?').run(1000, first.id);

    const second = repo.createCompletion({ id: crypto.randomUUID(), taskId: task.id });
    db.prepare('UPDATE completions SET completed_at = ? WHERE id = ?').run(2000, second.id);

    expect(repo.getTask(task.id)!.lastCompletedAt).toBe(2000);

    expect(repo.deleteCompletion(second.id)).toBe(true);

    const fetched = repo.getTask(task.id)!;
    expect(fetched.lastCompletedAt).toBe(1000);
    expect(fetched.completionCount).toBe(1);
  });

  it('deleteCompletion returns false for an unknown id', () => {
    expect(repo.deleteCompletion(crypto.randomUUID())).toBe(false);
  });

  it('stores an optional note', () => {
    const task = repo.createTask(makeTaskParams());
    const completion = repo.createCompletion({
      id: crypto.randomUUID(),
      taskId: task.id,
      note: 'done early',
    });
    expect(completion.note).toBe('done early');
  });
});
