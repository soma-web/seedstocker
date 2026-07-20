import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const db = new Database(dbPath);

console.log('=== FULL AUDIT RESULTS ===\n');

// 1. Non-strain items (Equipments / Filters mistakenly scraped as strains!)
const filtersAndEquipment = db.prepare(`
  SELECT s.id, s.name, s.breeder, o.shop, o.url
  FROM strains s
  LEFT JOIN scraped_offers o ON s.id = o.strain_id
  WHERE s.name LIKE '%filter%' OR s.name LIKE '%aktivkohle%' OR s.name LIKE '%m³/h%' OR s.name LIKE '%mm%'
`).all();

console.log(`--- 1. Equipments / Filter in Datenbank (${filtersAndEquipment.length} Fälle) ---`);
console.table(filtersAndEquipment);

// 2. Strain names containing Emojis or Marketing tags (e.g. Cookies Seedbank emojis like 🍿🎥HOLLYWOOD LINE🎬🎞️, 🍋Lemonnade Line🍋)
const emojiStrains = db.prepare(`
  SELECT s.id, s.name, s.breeder 
  FROM strains s
  WHERE s.name LIKE '%🍿%' OR s.name LIKE '%🍋%' OR s.name LIKE '%🎬%' OR s.name LIKE '%[*]' OR s.name LIKE '%Line%'
`).all();

console.log(`\n--- 2. Strain-Namen mit Emojis / Marketing-Klammern (${emojiStrains.length} Fälle) ---`);
console.table(emojiStrains);

// 3. Strain names containing Breeder names
const breederInNameStrains = db.prepare(`
  SELECT s.id, s.name, s.breeder 
  FROM strains s
  WHERE (s.name LIKE '%Barney%' AND s.breeder != 'Barney''s Farm')
     OR (s.name LIKE '%Sensi%' AND s.breeder != 'Sensi Seeds')
     OR (s.name LIKE '%Royal Queen%' AND s.breeder != 'Royal Queen Seeds')
     OR (s.name LIKE '%Dutch Passion%' AND s.breeder != 'Dutch Passion')
     OR s.name LIKE '%– Atlas Seed%'
`).all();

console.log(`\n--- 3. Breeder-Name oder Fremdhersteller im Strain-Namen (${breederInNameStrains.length} Fälle) ---`);
console.table(breederInNameStrains);

// 4. Bonus/Promo Pack details embedded in name (e.g. 7+1, 5+2)
const promoPackStrains = db.prepare(`
  SELECT s.id, s.name, s.breeder 
  FROM strains s
  WHERE s.name LIKE '%+1%' OR s.name LIKE '%+2%' OR s.name LIKE '%+3%' OR s.name LIKE '%+5%'
`).all();

console.log(`\n--- 4. Gratis-Samen / Bonus-Pack Zusätze im Namen (${promoPackStrains.length} Fälle) ---`);
console.table(promoPackStrains);

// 5. Typografische Apostrophe (smart quotes `’`, `´`, `„`, `“`)
const smartQuotesStrains = db.prepare(`
  SELECT s.id, s.name, s.breeder 
  FROM strains s
  WHERE s.name LIKE '%’%' OR s.name LIKE '%´%' OR s.name LIKE '%„%' OR s.name LIKE '%“%'
`).all();

console.log(`\n--- 5. Typografische Anführungszeichen / Apostrophe (${smartQuotesStrains.length} Fälle) ---`);
console.table(smartQuotesStrains);

db.close();
