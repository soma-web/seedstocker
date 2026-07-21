import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const suspectedPath = path.resolve(__dirname, '../data/suspected_non_strains.json');
const db = new Database(dbPath);

console.log('--- Step 1: Deleting suspected non-strains from database ---');

// Enable foreign keys
db.pragma('foreign_keys = ON');

if (!fs.existsSync(suspectedPath)) {
  console.error(`File not found: ${suspectedPath}`);
  process.exit(1);
}

const items = JSON.parse(fs.readFileSync(suspectedPath, 'utf8'));
console.log(`Found ${items.length} items to delete from DB.`);

const deleteStmt = db.prepare(`DELETE FROM strains WHERE id = ?`);

const transaction = db.transaction((list) => {
  for (const item of list) {
    const res = deleteStmt.run(item.id);
    console.log(`[DELETED] ${item.name} (${item.breeder}) - ID: ${item.id}`);
  }
});

transaction(items);
console.log(`Successfully deleted ${items.length} items from database.`);

// Step 2: Regenerate strains_missing_thc.json
const missingJsonPath = path.resolve(__dirname, '../data/strains_missing_thc.json');
const missingStrains = db.prepare(`
  SELECT id, name, breeder, thc, seedfinder_url, created_at, updated_at
  FROM strains
  WHERE thc IS NULL OR thc = '' OR thc = 'N/A' OR thc = 'Unknown' OR thc = '?'
  ORDER BY name ASC
`).all();

fs.writeFileSync(missingJsonPath, JSON.stringify(missingStrains, null, 2));
console.log(`Updated ${missingJsonPath} (${missingStrains.length} total missing strains remaining).`);

// Empty suspected_non_strains.json since all have been deleted
fs.writeFileSync(suspectedPath, JSON.stringify([], null, 2));
console.log(`Updated ${suspectedPath} (cleared).`);

db.close();
