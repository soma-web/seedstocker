import { sqlite } from '../server/src/db.js';

const updateStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = 'Eva Seeds'
  WHERE LOWER(breeder) IN ('eva female seeds', 'eva female seed', 'eva seeds', 'eva seed', 'eva')
`).run();

console.log('Updated strains:', updateStrains.changes);

const updateEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = 'Eva Seeds'
  WHERE LOWER(extracted_breeder) IN ('eva female seeds', 'eva female seed', 'eva seeds', 'eva seed', 'eva')
`).run();

console.log('Updated new_scraped_entries:', updateEntries.changes);
