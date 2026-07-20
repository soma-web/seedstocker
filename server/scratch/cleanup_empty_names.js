import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const db = new Database(dbPath);

console.log('--- Cleaning Empty/Blank Strain Names ---');

const emptyStrains = db.prepare(`
  SELECT id, name, breeder FROM strains WHERE TRIM(name) = '' OR name IS NULL
`).all();

console.log(`Found ${emptyStrains.length} empty strain name records.`);

for (const s of emptyStrains) {
  db.prepare('DELETE FROM scraped_offers WHERE strain_id = ?').run(s.id);
  db.prepare('DELETE FROM strains WHERE id = ?').run(s.id);
  console.log(`Deleted empty strain record ID: ${s.id}`);
}

db.close();
