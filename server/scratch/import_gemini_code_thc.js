import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const jsonPath = path.resolve(__dirname, '../data/gemini-code-1784620038281.json');

const db = new Database(dbPath);

if (!fs.existsSync(jsonPath)) {
  console.error(`JSON file not found: ${jsonPath}`);
  process.exit(1);
}

const entries = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const validEntries = entries.filter(e => e.thc && e.thc.trim() !== '');

console.log(`Total entries in JSON: ${entries.length}`);
console.log(`Found ${validEntries.length} entries with valid THC values to import.`);

const now = new Date().toISOString();

const selectStmt = db.prepare(`SELECT id, thc, name, breeder FROM strains WHERE id = ?`);
const updateStmt = db.prepare(`UPDATE strains SET thc = ?, updated_at = ? WHERE id = ?`);

let updatedCount = 0;
let skippedNotFound = 0;

const transaction = db.transaction(() => {
  for (const item of validEntries) {
    const existing = selectStmt.get(item.id);
    let targetId = null;

    if (existing) {
      targetId = existing.id;
    } else {
      const fallback = db.prepare(`
        SELECT id FROM strains 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) 
          AND LOWER(TRIM(breeder)) = LOWER(TRIM(?))
      `).get(item.name, item.breeder);

      if (fallback) {
        targetId = fallback.id;
      }
    }

    if (!targetId) {
      skippedNotFound++;
      console.log(`[NOT FOUND] ${item.name} (${item.breeder})`);
      continue;
    }

    let cleanThc = item.thc.trim();
    updateStmt.run(cleanThc, now, targetId);
    updatedCount++;
    console.log(`[UPDATED DB] ${item.name} (${item.breeder}) -> THC: ${cleanThc}`);
  }
});

transaction();

console.log('\n=== IMPORT SUMMARY ===');
console.log(`Successfully updated: ${updatedCount} strains`);
console.log(`Skipped (not found in DB): ${skippedNotFound}`);

// Regenerate strains_missing_thc.json
const missingJsonPath = path.resolve(__dirname, '../data/strains_missing_thc.json');
const missingStrains = db.prepare(`
  SELECT id, name, breeder, thc, seedfinder_url, created_at, updated_at
  FROM strains
  WHERE thc IS NULL OR thc = '' OR thc = 'N/A' OR thc = 'Unknown' OR thc = '?'
  ORDER BY name ASC
`).all();

fs.writeFileSync(missingJsonPath, JSON.stringify(missingStrains, null, 2));
console.log(`Updated ${missingJsonPath} (${missingStrains.length} total missing strains remaining).`);

const proposedJsonPath = path.resolve(__dirname, '../data/proposed_thc_updates.json');
if (fs.existsSync(proposedJsonPath)) {
  const remainingMissingIds = new Set(missingStrains.map(s => s.id));
  const existingProposed = JSON.parse(fs.readFileSync(proposedJsonPath, 'utf8'));
  const filteredProposed = existingProposed.filter(e => remainingMissingIds.has(e.id));
  fs.writeFileSync(proposedJsonPath, JSON.stringify(filteredProposed, null, 2));
  console.log(`Updated ${proposedJsonPath} (${filteredProposed.length} entries remaining).`);
}

db.close();
