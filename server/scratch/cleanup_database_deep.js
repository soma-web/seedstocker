import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const db = new Database(dbPath);

console.log('=== STARTING DEEP DATABASE CLEANUP ===\n');

const runCleanup = db.transaction(() => {
  // 1. Delete Non-Strain / Equipment Items
  const filterStrains = db.prepare(`
    SELECT id, name FROM strains 
    WHERE name LIKE '%filter%' OR name LIKE '%aktivkohle%' OR name LIKE '%m³/h%'
  `).all();

  for (const f of filterStrains) {
    db.prepare('DELETE FROM scraped_offers WHERE strain_id = ?').run(f.id);
    db.prepare('DELETE FROM strains WHERE id = ?').run(f.id);
    console.log(`[1] Deleted non-strain equipment item: "${f.name}" (ID: ${f.id})`);
  }

  // 2. Clean up Atlas Seed breeder
  const atlasStrains = db.prepare(`
    SELECT id, name FROM strains WHERE name LIKE '%– Atlas Seed%' OR name LIKE '%- Atlas Seed%'
  `).all();

  for (const a of atlasStrains) {
    const newName = a.name.replace(/\s*[–-]\s*Atlas Seed\s*/i, '').trim();
    db.prepare(`UPDATE strains SET name = ?, breeder = 'Atlas Seed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(newName, a.id);
    console.log(`[2] Fixed Atlas Seed strain: "${a.name}" -> "${newName}" (Breeder: "Atlas Seed")`);
  }

  // 3. Process all strains for Emojis, Marketing tags, Bonus pack suffixes, and Smart quotes
  const allStrains = db.prepare('SELECT id, name, breeder FROM strains').all();
  
  let emojiCount = 0;
  let bonusCount = 0;
  let quoteCount = 0;

  const updateStrainStmt = db.prepare(`
    UPDATE strains SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);

  for (const s of allStrains) {
    let name = s.name;
    const initialName = name;

    // Remove bracketed emoji / line tags e.g. [🍿🎥HOLLYWOOD LINE🎬🎞️], [🍋Lemonnade Line🍋]
    if (/\[.*?[🍿🎥🍋🎬🎞️Line].*?\]/i.test(name) || /\*/.test(name)) {
      name = name.replace(/\s*\[.*?[🍿🎥🍋🎬🎞️Line].*?\]/gi, '');
      name = name.replace(/\*/g, '');
      emojiCount++;
    }

    // Remove bonus pack suffix e.g. 7+1, 5+2, 10+3
    if (/\s+\d+\+\d+\s*$/i.test(name)) {
      name = name.replace(/\s+\d+\+\d+\s*$/i, '');
      bonusCount++;
    }

    // Replace smart quotes and backticks
    if (/[’´„“`]/.test(name)) {
      name = name.replace(/[’´`]/g, "'").replace(/[„“]/g, '"');
      quoteCount++;
    }

    // Clean up trailing/consecutive spaces
    name = name.replace(/\s{2,}/g, ' ').trim();

    if (name !== initialName) {
      updateStrainStmt.run(name, s.id);
      console.log(`[Cleaned] "${initialName}" -> "${name}"`);
    }
  }

  console.log(`\nSummary of cleaning:`);
  console.log(`- Non-strain equipment items deleted: ${filterStrains.length}`);
  console.log(`- Atlas Seed strains corrected: ${atlasStrains.length}`);
  console.log(`- Emoji / Marketing tags removed: ${emojiCount}`);
  console.log(`- Bonus-pack suffixes (7+1, etc.) removed: ${bonusCount}`);
  console.log(`- Smart quotes standardized: ${quoteCount}`);
});

try {
  runCleanup();
  console.log('\n=== DEEP DATABASE CLEANUP COMPLETED SUCCESSFULLY ===');
} catch (err) {
  console.error('\n!!! ERROR DURING CLEANUP, TRANSACTION ROLLED BACK !!!', err);
} finally {
  db.close();
}
