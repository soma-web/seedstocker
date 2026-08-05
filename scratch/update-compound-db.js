import { sqlite } from '../server/src/db.js';

const updateStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = 'Compound Genetics'
  WHERE LOWER(breeder) IN ('compound genetics seeds', 'compound genetics seed', 'compound genetics', 'compound genetcis seeds', 'compound genetcis', 'compound')
`).run();

console.log('Updated strains:', updateStrains.changes);

const updateEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = 'Compound Genetics'
  WHERE LOWER(extracted_breeder) IN ('compound genetics seeds', 'compound genetics seed', 'compound genetics', 'compound genetcis seeds', 'compound genetcis', 'compound')
`).run();

console.log('Updated new_scraped_entries:', updateEntries.changes);
