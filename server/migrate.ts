import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Filenames are date-prefixed (YYYY-MM-DD.N_...); N isn't zero-padded,
// so plain lexical sort would misorder past N=9 within the same day.
function compareMigrationFilenames(a: string, b: string): number {
  const [aDate, aRest] = a.split('.');
  const [bDate, bRest] = b.split('.');
  if (aDate !== bDate) return aDate < bDate ? -1 : 1;
  return parseInt(aRest, 10) - parseInt(bRest, 10);
}

export function runMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Map(
    (
      db.prepare('SELECT filename, checksum FROM _migrations').all() as {
        filename: string;
        checksum: string;
      }[]
    ).map((r) => [r.filename, r.checksum]),
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(compareMigrationFilenames);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');

    const appliedChecksum = applied.get(file);
    if (appliedChecksum !== undefined) {
      if (appliedChecksum !== checksum) {
        throw new Error(`migration ${file} was edited after being applied (checksum mismatch)`);
      }
      continue;
    }

    const apply = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (filename, checksum) VALUES (?, ?)').run(file, checksum);
    });

    console.log(`[migrate] applying ${file}`);
    apply();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runMigrations();
  console.log('[migrate] up to date');
}
