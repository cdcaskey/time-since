import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { faker } from '@faker-js/faker';
import type { FastifyInstance } from 'fastify';

// DATA_DIR is read at import time by db.ts, so it must be set — to a
// throwaway dir, isolated from any real $DATA_DIR — before app.ts (and
// its transitive db.ts import) are loaded. A static top-level import
// would be hoisted above this assignment, so the modules are loaded
// dynamically instead, after the env var is in place.
let app: FastifyInstance;
let dataDir: string;
let seededNames: string[];

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'spa-template-test-'));
  process.env.DATA_DIR = dataDir;

  const { runMigrations } = await import('./migrate.js');
  const { db } = await import('./db.js');
  const { buildApp } = await import('./app.js');

  runMigrations();

  seededNames = faker.helpers.multiple(() => faker.commerce.productName(), {
    count: faker.number.int({ min: 2, max: 5 }),
  });
  const insert = db.prepare('INSERT INTO example_items (name) VALUES (?)');
  for (const name of seededNames) insert.run(name);

  // No dist/ in this temp dir, so static file serving stays disabled.
  app = buildApp(path.join(dataDir, 'dist'));
});

afterAll(async () => {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
});

describe('GET /api/health', () => {
  it('reports ok when the db is reachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'ok' });
  });
});

describe('GET /api/example-items', () => {
  it('returns the seeded rows, most recent first', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/example-items' });
    expect(res.statusCode).toBe(200);

    const names = res.json().map((row: { name: string }) => row.name);
    expect(names).toEqual([...seededNames].reverse());
  });
});
