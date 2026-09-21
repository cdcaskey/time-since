import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let dataDir: string;
let runMigrations: typeof import('./migrate.js').runMigrations;
let db: typeof import('./db.js').db;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'time-since-migrate-test-'));
  process.env.DATA_DIR = dataDir;

  ({ runMigrations } = await import('./migrate.js'));
  ({ db } = await import('./db.js'));
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe('runMigrations', () => {
  it('applies cleanly from an empty database', () => {
    runMigrations();

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('tasks', 'completions')",
      )
      .all();
    expect(tables).toHaveLength(2);
  });

  it('is idempotent when re-run', () => {
    expect(() => runMigrations()).not.toThrow();

    const applied = db.prepare('SELECT filename FROM _migrations').all();
    expect(applied).toHaveLength(
      new Set(applied.map((r) => (r as { filename: string }).filename)).size,
    );
  });

  it('throws when an already-applied migration file is edited', () => {
    db.prepare('UPDATE _migrations SET checksum = ? WHERE filename LIKE ?').run(
      'tampered-checksum',
      '%_init.sql',
    );

    expect(() => runMigrations()).toThrow(/checksum mismatch/);
  });
});
