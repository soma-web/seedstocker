import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const csvPath = path.resolve(__dirname, '../data/thc_audit.csv');

const db = new Database(dbPath);

if (!fs.existsSync(csvPath)) {
  console.error(`CSV file not found: ${csvPath}`);
  process.exit(1);
}

// Simple robust CSV parser for thc_audit.csv
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const fileContent = fs.readFileSync(csvPath, 'utf8');
const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');

if (lines.length <= 1) {
  console.log('CSV is empty or only header.');
  process.exit(0);
}

const header = parseCsvLine(lines[0]);
console.log('CSV Header:', header);

// Find column indices
const idIdx = header.indexOf('id');
const nameIdx = header.indexOf('name');
const breederIdx = header.indexOf('breeder');
const thcIdx = header.indexOf('thc');

let totalInCsv = lines.length - 1;
let updatedCount = 0;
let skippedAlreadyHasThc = 0;
let skippedNotFoundInDb = 0;
let skippedInvalidThc = 0;

const now = new Date().toISOString();

const selectStmt = db.prepare(`SELECT id, thc, name, breeder FROM strains WHERE id = ?`);
const updateStmt = db.prepare(`UPDATE strains SET thc = ?, updated_at = ? WHERE id = ?`);

const transaction = db.transaction(() => {
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 4) continue;

    const id = row[idIdx];
    const name = row[nameIdx];
    const breeder = row[breederIdx];
    let rawThc = row[thcIdx];

    if (!id || !rawThc) {
      skippedInvalidThc++;
      continue;
    }

    // Clean THC value (e.g., "24" -> "24%")
    let cleanThc = rawThc.trim();
    if (/^\d+(\.\d+)?$/.test(cleanThc)) {
      cleanThc += '%';
    } else if (/^\d+(\.\d+)?-\d+(\.\d+)?$/.test(cleanThc)) {
      cleanThc += '%';
    }

    // Find in DB
    const existing = selectStmt.get(id);
    if (!existing) {
      // Try fallback lookup by name + breeder
      const fallback = db.prepare(`
        SELECT id, thc FROM strains 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) 
          AND LOWER(TRIM(breeder)) = LOWER(TRIM(?))
      `).get(name, breeder);

      if (!fallback) {
        skippedNotFoundInDb++;
        continue;
      }
      
      if (fallback.thc && fallback.thc.trim() !== '' && fallback.thc !== 'N/A' && fallback.thc !== 'Unknown' && fallback.thc !== '?') {
        skippedAlreadyHasThc++;
        continue;
      }

      updateStmt.run(cleanThc, now, fallback.id);
      updatedCount++;
      continue;
    }

    // Check if entry already has THC
    if (existing.thc && existing.thc.trim() !== '' && existing.thc !== 'N/A' && existing.thc !== 'Unknown' && existing.thc !== '?') {
      skippedAlreadyHasThc++;
      continue;
    }

    // Update missing THC entry
    updateStmt.run(cleanThc, now, id);
    updatedCount++;
  }
});

transaction();

console.log('\n=== CSV IMPORT SUMMARY ===');
console.log(`Total rows in CSV: ${totalInCsv}`);
console.log(`Successfully updated missing THC: ${updatedCount}`);
console.log(`Skipped (strain already had THC in DB): ${skippedAlreadyHasThc}`);
console.log(`Skipped (strain not found in DB): ${skippedNotFoundInDb}`);
console.log(`Skipped (invalid/empty THC value): ${skippedInvalidThc}`);

// Regenerate JSON files
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
  const existing = JSON.parse(fs.readFileSync(proposedJsonPath, 'utf8'));
  const remainingMissingIds = new Set(missingStrains.map(s => s.id));
  const filteredProposed = existing.filter(e => remainingMissingIds.has(e.id));
  fs.writeFileSync(proposedJsonPath, JSON.stringify(filteredProposed, null, 2));
  console.log(`Updated ${proposedJsonPath} (${filteredProposed.length} entries remaining).`);
}

db.close();
