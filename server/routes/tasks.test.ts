import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';

// Same isolation pattern as app.test.ts: DATA_DIR must be set before app.ts
// (and its transitive db.ts import) are loaded, so these are dynamic
// imports after the env var is in place.
let app: FastifyInstance;
let dataDir: string;
let db: typeof import('../db.js').db;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'time-since-routes-test-'));
  process.env.DATA_DIR = dataDir;

  const { runMigrations } = await import('../migrate.js');
  const { buildApp } = await import('../app.js');
  ({ db } = await import('../db.js'));

  runMigrations();

  app = buildApp(path.join(dataDir, 'dist'));
});

afterAll(async () => {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  db.exec('DELETE FROM completions; DELETE FROM tasks;');
});

const validTaskBody = {
  name: 'Clean gutters',
  description: 'Front and back',
  dueAfterSeconds: 100,
  overdueAfterSeconds: 200,
  urgentAfterSeconds: 400,
};

async function createTask(overrides: Partial<typeof validTaskBody> = {}) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    payload: { ...validTaskBody, ...overrides },
  });
  return res.json();
}

describe('POST /api/tasks', () => {
  it('creates a task and returns 201', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/tasks', payload: validTaskBody });
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body).toMatchObject({
      name: 'Clean gutters',
      description: 'Front and back',
      dueAfterSeconds: 100,
      overdueAfterSeconds: 200,
      urgentAfterSeconds: 400,
      lastCompletedAt: null,
      completionCount: 0,
    });
    expect(typeof body.id).toBe('string');
  });

  it('accepts an initialState override', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { ...validTaskBody, initialState: 'due' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().initialState).toBe('due');
  });

  it('rejects an invalid initialState, naming that field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { ...validTaskBody, initialState: 'later' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.field).toBe('initialState');
  });

  it('rejects a blank name with 400 naming the field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { ...validTaskBody, name: '   ' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.field).toBe('name');
  });

  it('rejects a non-positive dueAfterSeconds with 400 naming the field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { ...validTaskBody, dueAfterSeconds: 0 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.field).toBe('dueAfterSeconds');
  });

  it('rejects overdueAfterSeconds that does not exceed dueAfterSeconds, naming that field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { ...validTaskBody, overdueAfterSeconds: 100 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.field).toBe('overdueAfterSeconds');
  });

  it('rejects urgentAfterSeconds that does not exceed overdueAfterSeconds, naming that field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { ...validTaskBody, urgentAfterSeconds: 150 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.field).toBe('urgentAfterSeconds');
  });
});

describe('GET /api/tasks', () => {
  it('returns all tasks', async () => {
    await createTask({ name: 'A' });
    await createTask({ name: 'B' });

    const res = await app.inject({ method: 'GET', url: '/api/tasks' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
  });
});

describe('GET /api/tasks/:id', () => {
  it('returns the task', async () => {
    const created = await createTask();
    const res = await app.inject({ method: 'GET', url: `/api/tasks/${created.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(created.id);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/tasks/${crypto.randomUUID()}` });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.message).toBeTruthy();
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('updates a single field', async () => {
    const created = await createTask();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${created.id}`,
      payload: { name: 'Renamed' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Renamed');
  });

  it('validates the merged thresholds, not just the patched field in isolation', async () => {
    const created = await createTask();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${created.id}`,
      payload: { overdueAfterSeconds: 50 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.field).toBe('overdueAfterSeconds');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${crypto.randomUUID()}`,
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects an empty patch', async () => {
    const created = await createTask();
    const res = await app.inject({ method: 'PATCH', url: `/api/tasks/${created.id}`, payload: {} });
    expect(res.statusCode).toBe(400);
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('deletes the task and cascades its completions', async () => {
    const created = await createTask();
    await app.inject({
      method: 'POST',
      url: `/api/tasks/${created.id}/completions`,
      payload: { id: crypto.randomUUID() },
    });

    const res = await app.inject({ method: 'DELETE', url: `/api/tasks/${created.id}` });
    expect(res.statusCode).toBe(204);

    const getRes = await app.inject({ method: 'GET', url: `/api/tasks/${created.id}` });
    expect(getRes.statusCode).toBe(404);

    const remaining = db.prepare('SELECT * FROM completions WHERE task_id = ?').all(created.id);
    expect(remaining).toHaveLength(0);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/tasks/${crypto.randomUUID()}` });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/tasks/:id/completions', () => {
  it('records a completion and returns 201', async () => {
    const created = await createTask();
    const completionId = crypto.randomUUID();

    const res = await app.inject({
      method: 'POST',
      url: `/api/tasks/${created.id}/completions`,
      payload: { id: completionId, note: 'done early' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ id: completionId, taskId: created.id, note: 'done early' });

    const taskRes = await app.inject({ method: 'GET', url: `/api/tasks/${created.id}` });
    expect(taskRes.json().completionCount).toBe(1);
    expect(taskRes.json().lastCompletedAt).not.toBeNull();
  });

  it('returns 404 for an unknown task', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/tasks/${crypto.randomUUID()}/completions`,
      payload: { id: crypto.randomUUID() },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects a non-uuid completion id', async () => {
    const created = await createTask();
    const res = await app.inject({
      method: 'POST',
      url: `/api/tasks/${created.id}/completions`,
      payload: { id: 'not-a-uuid' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('DELETE /api/completions/:id', () => {
  it('deletes a completion', async () => {
    const created = await createTask();
    const completionId = crypto.randomUUID();
    await app.inject({
      method: 'POST',
      url: `/api/tasks/${created.id}/completions`,
      payload: { id: completionId },
    });

    const res = await app.inject({ method: 'DELETE', url: `/api/completions/${completionId}` });
    expect(res.statusCode).toBe(204);

    const taskRes = await app.inject({ method: 'GET', url: `/api/tasks/${created.id}` });
    expect(taskRes.json().completionCount).toBe(0);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/completions/${crypto.randomUUID()}`,
    });
    expect(res.statusCode).toBe(404);
  });
});
