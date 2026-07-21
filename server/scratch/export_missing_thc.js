import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const outputPath = path.resolve(__dirname, '../data/strains_missing_thc.json');

const db = new Database(dbPath);

const missingStrains = db.prepare(`
  SELECT id, name, breeder, thc, seedfinder_url, created_at, updated_at
  FROM strains
  WHERE thc IS NULL OR thc = '' OR thc = 'N/A' OR thc = 'Unknown' OR thc = '?'
  ORDER BY name ASC
`).all();

console.log(`Found ${missingStrains.length} strains with missing THC values.`);

fs.writeFileSync(outputPath, JSON.stringify(missingStrains, null, 2));
console.log(`Saved exported JSON to ${outputPath}`);

db.close();
