import { sqlite } from '../server/src/db.js';

const updateStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = '00 Seeds'
  WHERE LOWER(breeder) IN ('00 seeds bank', '00 seeds', '00 seed bank', '00 seedbank')
`).run();

console.log('Updated strains:', updateStrains.changes);

const updateEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = '00 Seeds'
  WHERE LOWER(extracted_breeder) IN ('00 seeds bank', '00 seeds', '00 seed bank', '00 seedbank')
`).run();

console.log('Updated new_scraped_entries:', updateEntries.changes);
