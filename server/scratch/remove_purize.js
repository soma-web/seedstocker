import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbs = [
  path.resolve(__dirname, '../data/seedstocker.db'),
  path.resolve(__dirname, '../../../SeedStockerWebsite/Database/seedstocker.db')
];

for (const dbPath of dbs) {
  if (!fs.existsSync(dbPath)) {
    console.log(`DB not found at ${dbPath}, skipping.`);
    continue;
  }
  console.log(`\n=== Processing DB: ${dbPath} ===`);
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  // Find strains matching 'purize'
  const matchingStrains = db.prepare(`
    SELECT id, name, breeder 
    FROM strains 
    WHERE LOWER(name) LIKE '%purize%' OR LOWER(breeder) LIKE '%purize%'
  `).all();

  console.log(`Found ${matchingStrains.length} matching strains in strains table:`);
  console.table(matchingStrains);

  const strainIds = matchingStrains.map(s => s.id);

  // Find scraped_offers matching 'purize' in URL or referencing matching strains
  const matchingOffers = db.prepare(`
    SELECT id, strain_id, shop, url 
    FROM scraped_offers 
    WHERE LOWER(url) LIKE '%purize%' 
       OR (strain_id IS NOT NULL AND strain_id IN (${strainIds.map(id => `'${id}'`).join(',') || "''"}))
  `).all();

  console.log(`Found ${matchingOffers.length} matching offers in scraped_offers table:`);
  console.table(matchingOffers);

  // Delete scraped_offers
  const deleteOffersRes = db.prepare(`
    DELETE FROM scraped_offers 
    WHERE LOWER(url) LIKE '%purize%' 
       OR (strain_id IS NOT NULL AND strain_id IN (${strainIds.map(id => `'${id}'`).join(',') || "''"}))
  `).run();
  console.log(`Deleted ${deleteOffersRes.changes} offers from scraped_offers table.`);

  // Delete strains
  const deleteStrainsRes = db.prepare(`
    DELETE FROM strains 
    WHERE LOWER(name) LIKE '%purize%' OR LOWER(breeder) LIKE '%purize%'
  `).run();
  console.log(`Deleted ${deleteStrainsRes.changes} strains from strains table.`);

  db.close();
}

// Step 2: Regenerate strains_missing_thc.json for server/data
const primaryDbPath = path.resolve(__dirname, '../data/seedstocker.db');
if (fs.existsSync(primaryDbPath)) {
  const db = new Database(primaryDbPath);
  const missingJsonPath = path.resolve(__dirname, '../data/strains_missing_thc.json');
  const missingStrains = db.prepare(`
    SELECT id, name, breeder, thc, seedfinder_url, created_at, updated_at
    FROM strains
    WHERE thc IS NULL OR thc = '' OR thc = 'N/A' OR thc = 'Unknown' OR thc = '?'
    ORDER BY name ASC
  `).all();

  fs.writeFileSync(missingJsonPath, JSON.stringify(missingStrains, null, 2));
  console.log(`Updated ${missingJsonPath} (${missingStrains.length} total missing strains remaining).`);

  // Step 3: Clean proposed_thc_updates.json
  const proposedJsonPath = path.resolve(__dirname, '../data/proposed_thc_updates.json');
  if (fs.existsSync(proposedJsonPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(proposedJsonPath, 'utf8'));
      const filtered = existing.filter(item => {
        const name = (item.name || '').toLowerCase();
        const breeder = (item.breeder || '').toLowerCase();
        return !name.includes('purize') && !breeder.includes('purize');
      });
      fs.writeFileSync(proposedJsonPath, JSON.stringify(filtered, null, 2));
      console.log(`Updated ${proposedJsonPath} (${filtered.length} entries remaining).`);
    } catch (err) {
      console.error('Error updating proposed_thc_updates.json:', err);
    }
  }
  db.close();
}
