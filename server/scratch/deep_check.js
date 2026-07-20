import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const db = new Database(dbPath);

console.log('--- Deep Check of Strain Names & Metadata ---');

// 1. HTML Entities in name or breeder
const htmlEntityStrains = db.prepare(`
  SELECT id, name, breeder 
  FROM strains 
  WHERE name LIKE '%&%' OR breeder LIKE '%&%'
`).all();

console.log('\n--- Strains with HTML entities (&...;) ---');
console.table(htmlEntityStrains);

// 2. Very short names (<3 chars)
const shortNameStrains = db.prepare(`
  SELECT id, name, breeder 
  FROM strains 
  WHERE LENGTH(name) < 3
`).all();

console.log('\n--- Very short Strain Names (<3 chars) ---');
console.table(shortNameStrains);

// 3. Check for specific strains like Backpackboys
const suspiciousBreederStrains = db.prepare(`
  SELECT s.id, s.name, s.breeder, o.shop, o.url
  FROM strains s
  LEFT JOIN scraped_offers o ON s.id = o.strain_id
  WHERE s.name LIKE '%Backpackboys%' OR s.breeder LIKE '%Black Cherry%' OR s.breeder LIKE '%Backpack%'
`).all();

console.log('\n--- Suspicious Breeder / Strain swap (e.g. Backpackboys) ---');
console.table(suspiciousBreederStrains);

// 4. Check all breeders in DB and their strain counts
const breeders = db.prepare(`
  SELECT breeder, COUNT(*) as count 
  FROM strains 
  GROUP BY breeder 
  ORDER BY count DESC
`).all();

console.log('\n--- All Breeders & Strain Counts ---');
console.table(breeders);

// 5. Look for breeder duplicates (e.g. Exotic Seed vs Exotic Seeds)
const exoticSeed = db.prepare(`
  SELECT id, name, breeder FROM strains WHERE breeder LIKE 'Exotic%'
`).all();

console.log('\n--- Exotic Seed(s) strains ---');
console.table(exoticSeed);

db.close();
