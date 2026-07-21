import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('./data/seedstocker.db');
const newDbPath = path.resolve('./data/seedstocker_repaired.db');
const backupPath = path.resolve(`./data/seedstocker_corrupt_backup_${Date.now()}.db`);

console.log('--- DB Repair Tool ---');
console.log('Source DB:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('Source DB file does not exist!');
  process.exit(1);
}

if (fs.existsSync(newDbPath)) {
  fs.unlinkSync(newDbPath);
}

const oldDb = new Database(dbPath, { readonly: true });
const newDb = new Database(newDbPath);

// Get list of all user tables
const tables = oldDb.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

console.log(`Found ${tables.length} tables:`, tables.map(t => t.name));

// Turn off foreign key constraints during repair copy
newDb.pragma('foreign_keys = OFF');

for (const { name, sql } of tables) {
  if (!sql) continue;
  console.log(`Processing table: ${name}...`);

  // Create table in new DB
  newDb.exec(sql);

  // Fetch rows from old DB (using raw select)
  let rows = [];
  try {
    rows = oldDb.prepare(`SELECT * FROM "${name}"`).all();
    console.log(`  Fetched ${rows.length} rows from ${name}`);
  } catch (err) {
    console.error(`  Error reading ${name}:`, err.message);
    // Try recovering row-by-row with ROWID if standard select fails
    try {
      const rowids = oldDb.prepare(`SELECT rowid FROM "${name}"`).all();
      rows = [];
      for (const { rowid } of rowids) {
        try {
          const row = oldDb.prepare(`SELECT * FROM "${name}" WHERE rowid = ?`).get(rowid);
          if (row) rows.push(row);
        } catch (e) {
          console.warn(`  Failed to read rowid ${rowid} from ${name}:`, e.message);
        }
      }
      console.log(`  Recovered ${rows.length} rows via ROWID iteration for ${name}`);
    } catch (e2) {
      console.error(`  Could not recover table ${name} via ROWID:`, e2.message);
    }
  }

  if (rows.length > 0) {
    const sample = rows[0];
    const columns = Object.keys(sample);
    const placeholders = columns.map(() => '?').join(', ');
    const insertStmt = newDb.prepare(`INSERT OR IGNORE INTO "${name}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`);

    const insertMany = newDb.transaction((items) => {
      let count = 0;
      for (const item of items) {
        const values = columns.map(col => item[col]);
        try {
          insertStmt.run(...values);
          count++;
        } catch (insertErr) {
          console.warn(`  Failed inserting row into ${name}:`, insertErr.message);
        }
      }
      return count;
    });

    const inserted = insertMany(rows);
    console.log(`  Inserted ${inserted} rows into new table ${name}`);
  }
}

// Re-create indexes from sqlite_master
const indexes = oldDb.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all();
console.log(`Creating ${indexes.length} indexes...`);
for (const { name, sql } of indexes) {
  try {
    newDb.exec(sql);
    console.log(`  Index created: ${name}`);
  } catch (err) {
    console.error(`  Failed to create index ${name}:`, err.message);
  }
}

// Re-enable FK and run integrity check on new DB
newDb.pragma('foreign_keys = ON');
const integrity = newDb.pragma('integrity_check');
console.log('Integrity check on repaired DB:', integrity);

oldDb.close();
newDb.close();

if (integrity.length === 1 && integrity[0].integrity_check === 'ok') {
  console.log('Success! Repaired database passed integrity check.');

  // Backup corrupted database files
  console.log(`Backing up original corrupted database to ${backupPath}...`);
  fs.copyFileSync(dbPath, backupPath);

  // Close and clean up shm/wal files if exist
  const shm = dbPath + '-shm';
  const wal = dbPath + '-wal';
  if (fs.existsSync(shm)) fs.unlinkSync(shm);
  if (fs.existsSync(wal)) fs.unlinkSync(wal);

  // Replace original db with repaired db
  fs.copyFileSync(newDbPath, dbPath);
  fs.unlinkSync(newDbPath);

  console.log('Database successfully replaced with repaired version!');
} else {
  console.error('Repaired database failed integrity check!', integrity);
}
