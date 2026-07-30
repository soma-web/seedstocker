import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../data');
fs.mkdirSync(dataDir, { recursive: true });

const sqlite = new DatabaseSync(path.join(dataDir, 'seedstocker.db'));

// Compatibility helpers for node:sqlite
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.pragma = (cmd) => sqlite.exec(`PRAGMA ${cmd}`);
sqlite.transaction = (fn) => (...args) => {
  sqlite.exec('BEGIN TRANSACTION');
  try {
    const res = fn(...args);
    sqlite.exec('COMMIT');
    return res;
  } catch (err) {
    sqlite.exec('ROLLBACK');
    throw err;
  }
};

export const db = drizzle(sqlite);
export { sqlite };
