import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const db = new Database(dbPath);

// Find missing THC strains that have shop descriptions or rewritten descriptions
const missingStrains = db.prepare(`
  SELECT s.id, s.name, s.breeder, s.seedfinder_url, d.description as shop_desc, r.description as rew_desc, a.description as ai_desc
  FROM strains s
  LEFT JOIN strain_shop_descriptions d ON s.id = d.strain_id
  LEFT JOIN rewritten_descriptions r ON s.id = r.strain_id
  LEFT JOIN ai_descriptions a ON s.id = a.strain_id
  WHERE s.thc IS NULL OR s.thc = '' OR s.thc = 'N/A' OR s.thc = 'Unknown' OR s.thc = '?'
`).all();

console.log('Total strains with missing THC:', missingStrains.length);

const regexes = [
  /THC\s*:\s*~?\s*(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?\s*%)/i,
  /THC\s*(?:content|gehalt|level|potency)?\s*(?:of|von|is|ist|:)?\s*~?\s*(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?\s*%)/i,
  /(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?\s*%)\s*THC/i,
  /up to\s*(\d{1,2}(?:\.\d+)?\s*%)\s*THC/i,
  /bis zu\s*(\d{1,2}(?:\.\d+)?\s*%)\s*THC/i
];

let extractableFromDescCount = 0;
let extractables = [];

for (const strain of missingStrains) {
  const combinedText = [strain.shop_desc, strain.rew_desc, strain.ai_desc].filter(Boolean).join(' ');
  if (!combinedText) continue;

  let foundThc = null;
  for (const reg of regexes) {
    const match = combinedText.match(reg);
    if (match) {
      foundThc = match[1] || match[0];
      break;
    }
  }

  if (foundThc) {
    extractableFromDescCount++;
    extractables.push({ id: strain.id, name: strain.name, breeder: strain.breeder, foundThc, textSample: combinedText.slice(0, 100) });
  }
}

console.log('Strains extractable from existing DB descriptions:', extractableFromDescCount);
console.log('Sample extractable:', extractables.slice(0, 10));

db.close();
