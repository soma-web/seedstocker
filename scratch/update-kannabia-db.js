import { sqlite } from '../server/src/db.js';

const rowsStrains = sqlite.prepare(`
  SELECT DISTINCT breeder, COUNT(*) as count
  FROM strains
  WHERE LOWER(breeder) LIKE '%kannabia%'
  GROUP BY breeder
`).all();

const rowsEntries = sqlite.prepare(`
  SELECT DISTINCT extracted_breeder, COUNT(*) as count
  FROM new_scraped_entries
  WHERE LOWER(extracted_breeder) LIKE '%kannabia%'
  GROUP BY extracted_breeder
`).all();

console.log('Before update Strains:', rowsStrains);
console.log('Before update Entries:', rowsEntries);

const updateStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = 'Kannabia Seeds'
  WHERE LOWER(breeder) IN ('kannabia', 'kannabia seeds', 'kannabia seed', 'kannabiaseeds')
`).run();

console.log('Updated strains:', updateStrains.changes);

const updateEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = 'Kannabia Seeds'
  WHERE LOWER(extracted_breeder) IN ('kannabia', 'kannabia seeds', 'kannabia seed', 'kannabiaseeds')
`).run();

console.log('Updated new_scraped_entries:', updateEntries.changes);
