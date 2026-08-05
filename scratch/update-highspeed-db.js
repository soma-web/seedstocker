import { sqlite } from '../server/src/db.js';

const updateStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = 'High Speed Buds'
  WHERE LOWER(breeder) IN ('high speeds buds', 'high speeds bud', 'high speed buds', 'high speed bud')
`).run();

console.log('Updated strains:', updateStrains.changes);

const updateEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = 'High Speed Buds'
  WHERE LOWER(extracted_breeder) IN ('high speeds buds', 'high speeds bud', 'high speed buds', 'high speed bud')
`).run();

console.log('Updated new_scraped_entries:', updateEntries.changes);
