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
sqlite.exec('PRAGMA busy_timeout = 10000;');
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

// Wrap prepare to add stmt.raw() compatibility for drizzle-orm
const origPrepare = sqlite.prepare.bind(sqlite);
sqlite.prepare = function(sql) {
  const stmt = origPrepare(sql);
  let isRaw = false;

  stmt.raw = function(rawVal = true) {
    isRaw = !!rawVal;
    return stmt;
  };

  const origAll = stmt.all.bind(stmt);
  stmt.all = function(...args) {
    const res = origAll(...args);
    if (isRaw && Array.isArray(res)) {
      return res.map(row => (typeof row === 'object' && row !== null ? Object.values(row) : row));
    }
    return res;
  };

  const origGet = stmt.get.bind(stmt);
  stmt.get = function(...args) {
    const res = origGet(...args);
    if (isRaw && res && typeof res === 'object') {
      return Object.values(res);
    }
    return res;
  };

  return stmt;
};

export const db = drizzle(sqlite);
export { sqlite };
