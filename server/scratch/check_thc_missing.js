import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const db = new Database(dbPath);

const total = db.prepare('SELECT COUNT(*) as c FROM strains').get().c;
const missingThc = db.prepare(`
  SELECT COUNT(*) as c FROM strains 
  WHERE thc IS NULL OR thc = '' OR thc = 'N/A' OR thc = 'Unknown' OR thc = '?'
`).get().c;

const missingThcWithUrl = db.prepare(`
  SELECT COUNT(*) as c FROM strains 
  WHERE (thc IS NULL OR thc = '' OR thc = 'N/A' OR thc = 'Unknown' OR thc = '?')
    AND seedfinder_url IS NOT NULL AND seedfinder_url != ''
`).get().c;

const missingThcWithoutUrl = db.prepare(`
  SELECT COUNT(*) as c FROM strains 
  WHERE (thc IS NULL OR thc = '' OR thc = 'N/A' OR thc = 'Unknown' OR thc = '?')
    AND (seedfinder_url IS NULL OR seedfinder_url = '')
`).get().c;

console.log('Total strains:', total);
console.log('Missing THC count:', missingThc);
console.log('  - With Seedfinder URL:', missingThcWithUrl);
console.log('  - Without Seedfinder URL:', missingThcWithoutUrl);

const sample = db.prepare(`
  SELECT id, name, breeder, thc, seedfinder_url 
  FROM strains 
  WHERE thc IS NULL OR thc = '' OR thc = 'N/A' OR thc = 'Unknown' OR thc = '?' 
  LIMIT 15
`).all();

console.log('Sample missing THC:');
console.table(sample);

const distinctBreeders = db.prepare(`
  SELECT breeder, COUNT(*) as count 
  FROM strains 
  WHERE thc IS NULL OR thc = '' OR thc = 'N/A' OR thc = 'Unknown' OR thc = '?' 
  GROUP BY breeder 
  ORDER BY count DESC
`).all();

console.log('\nMissing THC by breeder (top 15):');
console.table(distinctBreeders.slice(0, 15));

db.close();
