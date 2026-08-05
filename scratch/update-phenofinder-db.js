import { sqlite } from '../server/src/db.js';

const updateStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = 'Pheno Finder'
  WHERE LOWER(breeder) IN ('pheno finder seeds', 'pheno finder seed', 'pheno finder', 'phenofinder seeds', 'phenofinder')
`).run();

console.log('Updated strains:', updateStrains.changes);

const updateEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = 'Pheno Finder'
  WHERE LOWER(extracted_breeder) IN ('pheno finder seeds', 'pheno finder seed', 'pheno finder', 'phenofinder seeds', 'phenofinder')
`).run();

console.log('Updated new_scraped_entries:', updateEntries.changes);
