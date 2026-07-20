import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const db = new Database(dbPath);

console.log('=== SEEDSTOCKER DB STRAIN NAME & METADATA AUDIT ===\n');

// 1. Swapped Breeder / Strain Name
console.log('--- 1. Swapped / Misplaced Breeder or Strain Name ---');
const swapped = db.prepare(`
  SELECT s.id, s.name, s.breeder, o.shop, o.url 
  FROM strains s
  LEFT JOIN scraped_offers o ON s.id = o.strain_id
  WHERE s.breeder LIKE '%Gushers%' OR s.name LIKE '%x Barneys%' OR s.name LIKE '%Breeder%'
`).all();
console.table(swapped);

// 2. HTML Entities in Name or Breeder
console.log('\n--- 2. Unparsed HTML Entities in Name or Breeder ---');
const htmlEntities = db.prepare(`
  SELECT s.id, s.name, s.breeder, o.shop
  FROM strains s
  LEFT JOIN scraped_offers o ON s.id = o.strain_id
  WHERE s.name LIKE '%&%#%' OR s.name LIKE '%&%semi%' OR s.name LIKE '%&%eacute%' 
     OR s.breeder LIKE '%&%#%' OR s.name LIKE '%&#%'
`).all();
console.table(htmlEntities);

// 3. Short / Suspicious single letter Strain Names (<3 chars)
console.log('\n--- 3. Single / Extremely Short Strain Names (<3 chars) ---');
const shortNames = db.prepare(`
  SELECT s.id, s.name, s.breeder, o.shop, o.url
  FROM strains s
  LEFT JOIN scraped_offers o ON s.id = o.strain_id
  WHERE LENGTH(s.name) < 3
`).all();
console.table(shortNames);

// 4. Breeder Name Variations (e.g. Exotic Seed vs Exotic Seeds, etc.)
console.log('\n--- 4. Inconsistent Breeder Names in Database ---');
const breederVariations = db.prepare(`
  SELECT DISTINCT breeder FROM strains ORDER BY breeder ASC
`).all();
const breederList = breederVariations.map(b => b.breeder);

// Group similar breeders
const breederGroups = {};
breederList.forEach(b => {
  if (!b) return;
  const key = b.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!breederGroups[key]) breederGroups[key] = [];
  breederGroups[key].push(b);
});

const suspiciousBreeders = Object.values(breederGroups).filter(list => list.length > 1);
console.log('Breeders with multiple spellings/variations:', suspiciousBreeders);

// 5. Strain names with shop attributes / keywords embedded (Pack, Seeds, Feminized, etc.)
console.log('\n--- 5. Strain Names containing Shop Attributes or Keywords ---');
const keywordStrains = db.prepare(`
  SELECT s.id, s.name, s.breeder, o.shop
  FROM strains s
  LEFT JOIN scraped_offers o ON s.id = o.strain_id
  WHERE s.name LIKE '%Pack%' OR s.name LIKE '%Stk%' OR s.name LIKE '%Stück%' 
     OR s.name LIKE '%Feminisiert%' OR s.name LIKE '%Autoflower%' 
     OR s.name LIKE '% Automatic%' OR s.name LIKE '% Seeds%' OR s.name LIKE '% Samen%'
`).all();
console.table(keywordStrains);

// 6. Strain names ending with isolated ' e' or ' E'
console.log('\n--- 6. Strain Names ending with suspicious trailing " e" ---');
const trailingEStrains = db.prepare(`
  SELECT s.id, s.name, s.breeder, o.shop
  FROM strains s
  LEFT JOIN scraped_offers o ON s.id = o.strain_id
  WHERE s.name GLOB '* [eE]'
`).all();
console.table(trailingEStrains);

// 7. Duplicate Strains under different breeder spellings or exact duplicates
console.log('\n--- 7. Duplicate Strains due to Breeder variations (e.g. Exotic Seed vs Exotic Seeds) ---');
const duplicateBreederStrains = db.prepare(`
  SELECT s1.id as id1, s1.name as name1, s1.breeder as breeder1,
         s2.id as id2, s2.name as name2, s2.breeder as breeder2
  FROM strains s1
  JOIN strains s2 ON LOWER(s1.name) = LOWER(s2.name) AND s1.id < s2.id
  WHERE s1.breeder != s2.breeder
    AND REPLACE(LOWER(s1.breeder), 's', '') = REPLACE(LOWER(s2.breeder), 's', '')
`).all();
console.table(duplicateBreederStrains);

db.close();
