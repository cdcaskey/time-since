import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';

const DATA_DIR = process.env.DATA_DIR ?? '/data';

// Checked against the directory, not the db file: WAL mode writes -wal and
// -shm siblings alongside it, so the directory must be writable even when
// time-since.db already exists. process.getuid()/getgid() (not
// os.userInfo()) report identity, since an arbitrary uid inside a container
// has no /etc/passwd entry and os.userInfo() throws ENOENT for it — which
// would crash the error handler while it's reporting this error.
function assertWritable(dir: string): void {
  try {
    fs.accessSync(dir, fs.constants.W_OK);
  } catch {
    const uid = process.getuid?.();
    const gid = process.getgid?.();
    const identity = uid !== undefined ? `uid=${uid} gid=${gid}` : 'uid/gid unavailable';
    throw new Error(
      `DATA_DIR (${dir}) is not writable by this process (${identity}). ` +
        'Fix its ownership/permissions on the host, or point DATA_DIR at a writable ' +
        "path via docker-compose's environment: or $CONFIG_DIR/.env.",
    );
  }
}

fs.mkdirSync(DATA_DIR, { recursive: true });
assertWritable(DATA_DIR);

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
