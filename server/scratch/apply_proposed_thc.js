import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const jsonPath = path.resolve(__dirname, '../data/proposed_thc_updates.json');

const db = new Database(dbPath);

console.log('--- Step 1: Applying entries with proposedThc to database ---');

if (!fs.existsSync(jsonPath)) {
  console.error('File proposed_thc_updates.json does not exist!');
  process.exit(1);
}

const entries = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const validUpdates = entries.filter(e => e.proposedThc && e.proposedThc.trim() !== '');

console.log(`Total entries in JSON: ${entries.length}`);
console.log(`Found ${validUpdates.length} entries with valid proposedThc.`);

const stmt = db.prepare(`
  UPDATE strains 
  SET thc = ?, updated_at = ? 
  WHERE id = ?
`);

const now = new Date().toISOString();
let updatedCount = 0;

const transaction = db.transaction((items) => {
  for (const item of items) {
    const res = stmt.run(item.proposedThc.trim(), now, item.id);
    if (res.changes > 0) {
      updatedCount++;
      console.log(`[UPDATED DB] ${item.name} (${item.breeder}) -> THC: ${item.proposedThc}`);
    }
  }
});

transaction(validUpdates);
console.log(`\nSuccessfully updated ${updatedCount} strains in SQLite database.`);

db.close();

console.log('--- Step 2: Regenerating proposed_thc_updates.json for remaining missing THC strains ---');

// We will re-read database and regenerate JSON for remaining missing strains
const db2 = new Database(dbPath);

const thcRegexes = [
  /THC\s*:\s*~?\s*(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?\s*%)/i,
  /THC\s*(?:content|gehalt|level|potency)?\s*(?:of|von|is|ist|:)?\s*~?\s*(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?\s*%)/i,
  /(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?\s*%)\s*THC/i,
  /up to\s*(\d{1,2}(?:\.\d+)?\s*%)\s*THC/i,
  /bis zu\s*(\d{1,2}(?:\.\d+)?\s*%)\s*THC/i,
  /(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?\s*%)/i
];

function cleanThcValue(raw) {
  if (!raw) return null;
  let val = raw.trim().replace(/\s+/g, '');
  const m = val.match(/(\d{1,2}(?:\.\d+)?(?:-\d{1,2}(?:\.\d+)?)?%?)/);
  if (!m) return null;
  let res = m[1];
  if (!res.endsWith('%')) res += '%';
  const nums = res.replace('%', '').split('-').map(Number);
  if (nums.some(n => n <= 0 || n > 45)) return null;
  return res;
}

function searchInText(text) {
  if (!text) return null;
  for (const reg of thcRegexes) {
    const match = text.match(reg);
    if (match && match[1]) {
      const cleaned = cleanThcValue(match[1]);
      if (cleaned) return { val: cleaned, snippet: match[0] };
    }
  }
  return null;
}

const remainingMissing = db2.prepare(`
  SELECT s.id, s.name, s.breeder, s.seedfinder_url, d.description as shop_desc, r.description as rew_desc, a.description as ai_desc
  FROM strains s
  LEFT JOIN strain_shop_descriptions d ON s.id = d.strain_id
  LEFT JOIN rewritten_descriptions r ON s.id = r.strain_id
  LEFT JOIN ai_descriptions a ON s.id = a.strain_id
  WHERE s.thc IS NULL OR s.thc = '' OR s.thc = 'N/A' OR s.thc = 'Unknown' OR s.thc = '?'
`).all();

console.log(`Remaining missing THC strains in DB: ${remainingMissing.length}`);

// Rebuild initial JSON entries from DB text and Seedfinder URLs
const newJson = remainingMissing.map(s => {
  const dbText = [s.shop_desc, s.rew_desc, s.ai_desc].filter(Boolean).join(' ');
  const fromDb = searchInText(dbText);
  
  return {
    id: s.id,
    name: s.name,
    breeder: s.breeder || 'Unknown',
    proposedThc: fromDb ? fromDb.val : null,
    source: fromDb ? 'Existing DB Description' : null,
    snippet: fromDb ? fromDb.snippet : null,
    checkedAt: new Date().toISOString()
  };
});

fs.writeFileSync(jsonPath, JSON.stringify(newJson, null, 2));
console.log(`Regenerated ${jsonPath} with ${newJson.length} remaining missing entries (${newJson.filter(j => j.proposedThc).length} with DB-found THC).`);

db2.close();
