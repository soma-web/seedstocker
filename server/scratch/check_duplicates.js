import Database from 'better-sqlite3';

const dbPath = './data/seedstocker.db';
const db = new Database(dbPath);

try {
  // Find strains with breeder = 'Research' where there's also a strain with breeder = 'Sensi Seeds' and the same name
  const duplicates = db.prepare(`
    SELECT r.id AS research_id, r.name AS research_name, s.id AS sensi_id, s.name AS sensi_name
    FROM strains r
    JOIN strains s ON LOWER(TRIM(r.name)) = LOWER(TRIM(s.name))
    WHERE r.breeder = 'Research' AND s.breeder = 'Sensi Seeds'
  `).all();

  console.log('--- Duplicate Strains Found ---');
  console.log(`Found ${duplicates.length} duplicate name entries:`);
  console.log(JSON.stringify(duplicates, null, 2));
} catch (err) {
  console.error('Error running check:', err);
} finally {
  db.close();
}
