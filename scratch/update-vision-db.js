import { sqlite } from '../server/src/db.js';

const updateStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = 'Vision Seeds'
  WHERE LOWER(breeder) IN ('vision', 'vision seeds', 'vision seed', 'visionseeds')
`).run();

console.log('Updated strains:', updateStrains.changes);

const updateEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = 'Vision Seeds'
  WHERE LOWER(extracted_breeder) IN ('vision', 'vision seeds', 'vision seed', 'visionseeds')
`).run();

console.log('Updated new_scraped_entries:', updateEntries.changes);
