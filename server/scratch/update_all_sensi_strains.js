import Database from 'better-sqlite3';

const dbPath = './data/seedstocker.db';
const db = new Database(dbPath);

try {
  // Update "Durchschnittliche Blütezeit" for any strain sold by the Sensi Seeds shop
  const res1 = db.prepare(`
    UPDATE strains 
    SET flowering_time = '8-9', flowering_min = 8, flowering_max = 9 
    WHERE flowering_time = 'Durchschnittliche Blütezeit'
      AND id IN (SELECT strain_id FROM scraped_offers WHERE shop = 'Sensi Seeds')
  `).run();
  console.log(`Updated ${res1.changes} strains with 'Durchschnittliche Blütezeit' sold by Sensi Seeds.`);

  // Update "Kurze Blütezeit" for any strain sold by the Sensi Seeds shop
  const res2 = db.prepare(`
    UPDATE strains 
    SET flowering_time = '7-8', flowering_min = 7, flowering_max = 8 
    WHERE flowering_time = 'Kurze Blütezeit'
      AND id IN (SELECT strain_id FROM scraped_offers WHERE shop = 'Sensi Seeds')
  `).run();
  console.log(`Updated ${res2.changes} strains with 'Kurze Blütezeit' sold by Sensi Seeds.`);

  // Update "Lange Blütezeit" for any strain sold by the Sensi Seeds shop
  const res3 = db.prepare(`
    UPDATE strains 
    SET flowering_time = '9-11', flowering_min = 9, flowering_max = 11 
    WHERE flowering_time = 'Lange Blütezeit'
      AND id IN (SELECT strain_id FROM scraped_offers WHERE shop = 'Sensi Seeds')
  `).run();
  console.log(`Updated ${res3.changes} strains with 'Lange Blütezeit' sold by Sensi Seeds.`);

  // Update "Extralange Blütezeit" for any strain sold by the Sensi Seeds shop
  const res4 = db.prepare(`
    UPDATE strains 
    SET flowering_time = '11-13', flowering_min = 11, flowering_max = 13 
    WHERE flowering_time = 'Extralange Blütezeit'
      AND id IN (SELECT strain_id FROM scraped_offers WHERE shop = 'Sensi Seeds')
  `).run();
  console.log(`Updated ${res4.changes} strains with 'Extralange Blütezeit' sold by Sensi Seeds.`);
} catch (err) {
  console.error('Error running update:', err);
} finally {
  db.close();
}
