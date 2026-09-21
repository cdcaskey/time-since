import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Root ignores directory mode bits entirely, so a chmod 0500 directory would
// still be "writable" and this test would wrongly pass — skip under root
// rather than assert a false negative.
const isRoot = process.getuid?.() === 0;

describe.skipIf(isRoot)('db writability preflight', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(tmpdir(), 'time-since-db-test-'));
    chmodSync(dataDir, 0o500);
    process.env.DATA_DIR = dataDir;
  });

  afterEach(() => {
    chmodSync(dataDir, 0o700);
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('throws a descriptive error naming DATA_DIR when it is not writable', async () => {
    await expect(import('./db.js')).rejects.toThrow(
      new RegExp(
        `DATA_DIR \\(${dataDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\) is not writable`,
      ),
    );
  });
});
