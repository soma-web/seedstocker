import { sqlite } from '../server/src/db.js';

const updateStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = 'Original Sensible'
  WHERE LOWER(breeder) IN ('original sensible seeds', 'original sensible seed', 'original sensible', 'original sensible seedbank')
`).run();

console.log('Updated strains:', updateStrains.changes);

const updateEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = 'Original Sensible'
  WHERE LOWER(extracted_breeder) IN ('original sensible seeds', 'original sensible seed', 'original sensible', 'original sensible seedbank')
`).run();

console.log('Updated new_scraped_entries:', updateEntries.changes);
