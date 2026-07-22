import Database from 'better-sqlite3';
import path from 'path';

const dbs = [
  'E:\\Projects\\SeedStocker\\server\\data\\seedstocker.db',
  'E:\\Projects\\SeedStockerWebsite\\Database\\seedstocker.db'
];

for (const dbPath of dbs) {
  console.log('====================================');
  console.log('=== Details for DB:', dbPath);
  console.log('====================================');
  const db = new Database(dbPath);
  
  // 1. Check strains table
  const purizeStrains = db.prepare(`
    SELECT * FROM strains 
    WHERE LOWER(name) LIKE '%purize%' OR LOWER(breeder) LIKE '%purize%' OR id = 'ad01ac93-ffc6-403f-9ed7-07d9219ad17f'
  `).all();
  console.log(`\n--- Matching strains (${purizeStrains.length}):`);
  console.log(JSON.stringify(purizeStrains, null, 2));

  const strainIds = purizeStrains.map(s => s.id);

  // Check schema of scraped_offers
  const cols = db.prepare("PRAGMA table_info('scraped_offers')").all().map(c => c.name);
  console.log('\n--- scraped_offers columns:', cols.join(', '));

  // 2. Check scraped_offers table by strain_id or text
  const whereClauses = [];
  if (cols.includes('url')) whereClauses.push("LOWER(url) LIKE '%purize%'");
  if (cols.includes('title')) whereClauses.push("LOWER(title) LIKE '%purize%'");
  if (cols.includes('product_name')) whereClauses.push("LOWER(product_name) LIKE '%purize%'");
  if (strainIds.length > 0) {
    whereClauses.push(`strain_id IN (${strainIds.map(id => `'${id}'`).join(',')})`);
  }

  if (whereClauses.length > 0) {
    const query = `SELECT * FROM scraped_offers WHERE ${whereClauses.join(' OR ')}`;
    const purizeScrapedOffers = db.prepare(query).all();
    console.log(`\n--- Matching scraped_offers (${purizeScrapedOffers.length}):`);
    console.log(JSON.stringify(purizeScrapedOffers, null, 2));
  }

  db.close();
}
