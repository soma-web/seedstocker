import Database from 'better-sqlite3';

const dbPath = './data/seedstocker.db';
const db = new Database(dbPath);

try {
  // Query strains associated with 'Sensi Seeds' shop where flowering_time is not null and has no digits
  const strains = db.prepare(`
    SELECT DISTINCT s.id, s.name, s.breeder, s.flowering_time 
    FROM strains s
    JOIN scraped_offers o ON s.id = o.strain_id
    WHERE o.shop = 'Sensi Seeds'
      AND s.flowering_time IS NOT NULL
      AND s.flowering_time NOT GLOB '*[0-9]*'
  `).all();

  console.log('--- Strains from Sensi Seeds shop with no digits in flowering time ---');
  console.log(`Found ${strains.length} records:`);
  console.log(strains);
} catch (err) {
  console.error('Error running query:', err);
} finally {
  db.close();
}
