import { sqlite } from '../server/src/db.js';

const updateStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = 'Perfect Tree'
  WHERE LOWER(breeder) IN ('perfect tree', 'perfect tree seeds', 'the perfect tree', 'the perfect tree seeds', 'perfecttree')
`).run();

console.log('Updated strains:', updateStrains.changes);

const updateEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = 'Perfect Tree'
  WHERE LOWER(extracted_breeder) IN ('perfect tree', 'perfect tree seeds', 'the perfect tree', 'the perfect tree seeds', 'perfecttree')
`).run();

console.log('Updated new_scraped_entries:', updateEntries.changes);
