import Database from 'better-sqlite3';

const dbPath = './data/seedstocker.db';
const db = new Database(dbPath);

try {
  const result = db.prepare(`
    SELECT s.id, s.name, s.breeder, o.shop, o.url
    FROM strains s
    LEFT JOIN scraped_offers o ON s.id = o.strain_id
    WHERE s.breeder LIKE '%Research%'
       OR (o.shop = 'Sensi Seeds' AND s.breeder = 'Research')
  `).all();

  console.log('--- Database query results ---');
  console.log(`Found ${result.length} entries:`);
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error('Error running query:', err);
} finally {
  db.close();
}
