import { sqlite } from '../server/src/db.js';

const updateStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = 'Green House Seeds'
  WHERE LOWER(breeder) IN ('green house seed company', 'greenhouse seed company', 'green house seeds', 'greenhouse seeds', 'green house', 'greenhouse')
`).run();

console.log('Updated strains:', updateStrains.changes);

const updateEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = 'Green House Seeds'
  WHERE LOWER(extracted_breeder) IN ('green house seed company', 'greenhouse seed company', 'green house seeds', 'greenhouse seeds', 'green house', 'greenhouse')
`).run();

console.log('Updated new_scraped_entries:', updateEntries.changes);
