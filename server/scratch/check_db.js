import Database from 'better-sqlite3';

const dbPath = './data/seedstocker.db';
const db = new Database(dbPath);

try {
  // Enable foreign keys for cascade deletes
  db.pragma('foreign_keys = ON');
  
  // Find which ones we are going to delete first for logging
  const toDelete = db.prepare("SELECT id, name, breeder FROM strains WHERE name LIKE '%mix%'").all();
  console.log('Strains to delete:', toDelete);

  // Perform delete
  const res = db.prepare("DELETE FROM strains WHERE name LIKE '%mix%'").run();
  console.log(`Successfully deleted ${res.changes} strains containing 'mix' from the database.`);
} catch (err) {
  console.error('Error running check:', err);
} finally {
  db.close();
}
