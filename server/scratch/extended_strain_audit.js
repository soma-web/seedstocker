import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const db = new Database(dbPath);

console.log('=== EXTENDED STRAIN NAME AUDIT ===\n');

const strains = db.prepare('SELECT id, name, breeder, created_at FROM strains ORDER BY name ASC').all();
console.log(`Total strains in database: ${strains.length}\n`);

const categories = {
  breederInName: [],
  shopKeywordOrPackSize: [],
  strangePunctuationOrFormatting: [],
  suspiciousNumbersOrPercents: [],
  veryLongNames: [],
  genericOrBreederOnly: [],
  uncommonChars: [],
  duplicateVariations: []
};

// 1. Audit individual strains
strains.forEach(s => {
  const name = s.name || '';
  const breeder = s.breeder || '';

  // Breeder included in strain name (e.g. "Royal Queen Seeds Northern Light" or "Sensi Seeds Big Bud")
  if (breeder && breeder.length > 3) {
    // Escape regex special chars in breeder
    const escapedBreeder = breeder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedBreeder}\\b`, 'i');
    if (regex.test(name)) {
      categories.breederInName.push({ id: s.id, name, breeder });
    }
  }

  // Shop keywords / pack sizes / German or English descriptors
  if (/(pack|stk|stück|samen|seeds|versand|kaufen|bestellen|autoflowering|feminisierte|feminised|regular|fast version|auto-flowering|3er|5er|10er|100%|indoor|outdoor)/i.test(name)) {
    categories.shopKeywordOrPackSize.push({ id: s.id, name, breeder });
  }

  // Strange punctuation or formatting (leading/trailing dots or hyphens, multiple spaces, quotes)
  if (/^[.\-_\s]|[.\-_\s]$|\s{2,}|[\\/|~#$@!%^*_+={}[\]<>]/.test(name)) {
    categories.strangePunctuationOrFormatting.push({ id: s.id, name, breeder });
  }

  // Numbers or percentages that might be pack size or THC (e.g. "5 Stk", "25%", "3 Seed")
  if (/\b\d+\s*(stk|stück|seeds?|samen|pack|er|%|euro|€)\b/i.test(name)) {
    categories.suspiciousNumbersOrPercents.push({ id: s.id, name, breeder });
  }

  // Very long names (> 40 characters)
  if (name.length > 40) {
    categories.veryLongNames.push({ id: s.id, name, breeder, length: name.length });
  }

  // Name equals breeder or generic term
  if (name.trim().toLowerCase() === breeder.trim().toLowerCase() || /^(seed|samen|strain|cannabis|marijuana|default|test|unknown)$/i.test(name)) {
    categories.genericOrBreederOnly.push({ id: s.id, name, breeder });
  }

  // Non-ASCII characters (other than standard german umlauts ä, ö, ü, ß or accents é, è, ñ)
  if (/[^\x00-\x7FäöüÄÖÜßéèêàáâñôóòïîç]'?/.test(name)) {
    categories.uncommonChars.push({ id: s.id, name, breeder });
  }
});

// Print findings by category
console.log(`--- 1. Breeder-Name im Strain-Namen enthalten (${categories.breederInName.length} Fälle) ---`);
if (categories.breederInName.length > 0) console.table(categories.breederInName);

console.log(`\n--- 2. Shop-Schlüsselwörter / Genetik-Zusätze / Packungsgrößen (${categories.shopKeywordOrPackSize.length} Fälle) ---`);
if (categories.shopKeywordOrPackSize.length > 0) console.table(categories.shopKeywordOrPackSize);

console.log(`\n--- 3. Merkwürdige Zeichen / Formattierung (Sonderzeichen, Mehrfach-Leerzeichen, Führende/Endende Bindestriche) (${categories.strangePunctuationOrFormatting.length} Fälle) ---`);
if (categories.strangePunctuationOrFormatting.length > 0) console.table(categories.strangePunctuationOrFormatting.slice(0, 30));

console.log(`\n--- 4. Sehr lange Sortennamen (>40 Zeichen) (${categories.veryLongNames.length} Fälle) ---`);
if (categories.veryLongNames.length > 0) console.table(categories.veryLongNames);

console.log(`\n--- 5. Strain-Name identisch mit Breeder oder Generisch (${categories.genericOrBreederOnly.length} Fälle) ---`);
if (categories.genericOrBreederOnly.length > 0) console.table(categories.genericOrBreederOnly);

console.log(`\n--- 6. Ungewöhnliche Sonderzeichen/Emojis (${categories.uncommonChars.length} Fälle) ---`);
if (categories.uncommonChars.length > 0) console.table(categories.uncommonChars);

db.close();
