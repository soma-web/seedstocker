import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const db = new Database(dbPath);

console.log('--- Step 1: Deleting pH Down items from database ---');

// Enable foreign keys
db.pragma('foreign_keys = ON');

const targetStrains = db.prepare(`
  SELECT id, name, breeder 
  FROM strains 
  WHERE LOWER(name) LIKE '%ph down%' OR LOWER(name) LIKE '%ph-down%' OR LOWER(breeder) LIKE '%ph down%'
`).all();

console.log(`Found ${targetStrains.length} strains matching "pH Down":`);
console.table(targetStrains);

const res = db.prepare(`
  DELETE FROM strains 
  WHERE LOWER(name) LIKE '%ph down%' OR LOWER(name) LIKE '%ph-down%' OR LOWER(breeder) LIKE '%ph down%'
`).run();

console.log(`Deleted ${res.changes} strain entries from database.`);

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

// Step 3: Clean proposed_thc_updates.json
const proposedJsonPath = path.resolve(__dirname, '../data/proposed_thc_updates.json');
if (fs.existsSync(proposedJsonPath)) {
  try {
    const existing = JSON.parse(fs.readFileSync(proposedJsonPath, 'utf8'));
    const filtered = existing.filter(item => {
      const name = (item.name || '').toLowerCase();
      const breeder = (item.breeder || '').toLowerCase();
      return !name.includes('ph down') && !name.includes('ph-down') && !breeder.includes('ph down');
    });
    fs.writeFileSync(proposedJsonPath, JSON.stringify(filtered, null, 2));
    console.log(`Updated ${proposedJsonPath} (${filtered.length} entries remaining).`);
  } catch (err) {
    console.error('Error updating proposed_thc_updates.json:', err);
  }
}

db.close();
