import { sqlite } from '../server/src/db.js';

const updateStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = '420 Fast Buds'
  WHERE LOWER(breeder) IN ('fast buds company', 'fastbuds company', 'fast bud company')
`).run();

console.log('Updated strains:', updateStrains.changes);

const updateEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = '420 Fast Buds'
  WHERE LOWER(extracted_breeder) IN ('fast buds company', 'fastbuds company', 'fast bud company')
`).run();

console.log('Updated new_scraped_entries:', updateEntries.changes);
