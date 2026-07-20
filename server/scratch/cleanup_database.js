import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const db = new Database(dbPath);

console.log('=== STARTING DATABASE CLEANUP ===\n');

const runCleanup = db.transaction(() => {
  // 1. Fix swapped Strain Name & Breeder
  const swappedStmt = db.prepare(`
    UPDATE strains 
    SET name = 'Black Cherry Gushers', breeder = 'Backpack Boyz x Barney''s Farm', updated_at = CURRENT_TIMESTAMP
    WHERE id = '1bcc0db0-0ac4-4b9f-b8ed-2ca8e3ff877c'
  `);
  const swappedResult = swappedStmt.run();
  console.log(`[1] Fixed swapped strain/breeder (Backpackboys x Barneys): ${swappedResult.changes} record updated.`);

  // 2. Decode HTML Entities in Strain Names and Breeder Names
  const strainsWithHtml = db.prepare(`
    SELECT id, name, breeder 
    FROM strains 
    WHERE name LIKE '%&%' OR breeder LIKE '%&%'
  `).all();

  const decodeHtml = (str) => {
    if (!str) return str;
    return str
      .replace(/&#039;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&eacute;/g, 'é')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&');
  };

  let htmlFixCount = 0;
  const updateHtmlStmt = db.prepare(`
    UPDATE strains SET name = ?, breeder = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);

  for (const s of strainsWithHtml) {
    const newName = decodeHtml(s.name);
    const newBreeder = decodeHtml(s.breeder);
    if (newName !== s.name || newBreeder !== s.breeder) {
      updateHtmlStmt.run(newName, newBreeder, s.id);
      console.log(`[2] HTML Entity fixed: "${s.name}" -> "${newName}" (Breeder: "${newBreeder}")`);
      htmlFixCount++;
    }
  }
  console.log(`Total HTML entities fixed: ${htmlFixCount}`);

  // 3. Normalize Breeder names & Merge duplicates
  const breederMappings = [
    { from: 'Exotic Seed', to: 'Exotic Seeds' },
    { from: 'HolyHemp', to: 'Holy Hemp' }
  ];

  const getStrainByNameBreeder = db.prepare(`
    SELECT id FROM strains WHERE LOWER(name) = LOWER(?) AND breeder = ?
  `);

  const updateOfferStrainId = db.prepare(`
    UPDATE scraped_offers SET strain_id = ? WHERE strain_id = ?
  `);

  const deleteStrain = db.prepare(`
    DELETE FROM strains WHERE id = ?
  `);

  const updateBreederStmt = db.prepare(`
    UPDATE strains SET breeder = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);

  for (const mapping of breederMappings) {
    const fromStrains = db.prepare(`
      SELECT id, name, breeder FROM strains WHERE breeder = ?
    `).all(mapping.from);

    console.log(`\nProcessing breeder normalization: "${mapping.from}" -> "${mapping.to}" (${fromStrains.length} strains)`);

    for (const s of fromStrains) {
      const existing = getStrainByNameBreeder.get(s.name, mapping.to);

      if (existing && existing.id !== s.id) {
        // Merge: move offers to existing target strain ID and delete the duplicate strain record
        const offersMoved = updateOfferStrainId.run(existing.id, s.id).changes;
        deleteStrain.run(s.id);
        console.log(` -> Merged duplicate strain "${s.name}" (ID: ${s.id} -> ${existing.id}), moved ${offersMoved} offers.`);
      } else {
        // Simple rename of breeder
        updateBreederStmt.run(mapping.to, s.id);
        console.log(` -> Renamed breeder for strain "${s.name}" to "${mapping.to}".`);
      }
    }
  }
});

try {
  runCleanup();
  console.log('\n=== DATABASE CLEANUP COMPLETED SUCCESSFULLY ===');
} catch (err) {
  console.error('\n!!! ERROR DURING CLEANUP, TRANSACTION ROLLED BACK !!!', err);
} finally {
  db.close();
}
