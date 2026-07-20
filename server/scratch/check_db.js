import Database from 'better-sqlite3';

const dbPath = './data/seedstocker.db';
const db = new Database(dbPath);

try {
  const strains = db.prepare(`
    SELECT id, name, breeder, flowering_time, flowering_min, flowering_max 
    FROM strains 
    WHERE flowering_time LIKE '%Blütezeit%' OR flowering_time IS NULL
  `).all();
  console.log('Strains with German flowering_time or NULL:', strains);
} catch (err) {
  console.error('Error running check:', err);
} finally {
  db.close();
}
