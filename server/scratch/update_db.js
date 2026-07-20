import Database from 'better-sqlite3';

const dbPath = './data/seedstocker.db';
const db = new Database(dbPath);

try {
  // Update "Durchschnittliche Blütezeit"
  const res1 = db.prepare(`
    UPDATE strains 
    SET flowering_time = '8-9', flowering_min = 8, flowering_max = 9 
    WHERE breeder = 'Sensi Seeds' AND flowering_time = 'Durchschnittliche Blütezeit'
  `).run();
  console.log(`Updated ${res1.changes} strains with 'Durchschnittliche Blütezeit'.`);

  // Update "Kurze Blütezeit"
  const res2 = db.prepare(`
    UPDATE strains 
    SET flowering_time = '7-8', flowering_min = 7, flowering_max = 8 
    WHERE breeder = 'Sensi Seeds' AND flowering_time = 'Kurze Blütezeit'
  `).run();
  console.log(`Updated ${res2.changes} strains with 'Kurze Blütezeit'.`);
} catch (err) {
  console.error('Error running update:', err);
} finally {
  db.close();
}
