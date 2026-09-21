import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';

const DATA_DIR = process.env.DATA_DIR ?? '/data';

fs.mkdirSync(DATA_DIR, { recursive: true });

export const dbPath = path.join(DATA_DIR, 'time-since.db');

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');

export function checkDb(): boolean {
  try {
    db.prepare('SELECT 1').get();
    return true;
  } catch {
    return false;
  }
}
