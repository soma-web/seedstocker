import { sqlite } from '../server/src/db.js';

const updateStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = 'T.H. Seeds'
  WHERE LOWER(breeder) IN ('th seeds', 'thseeds', 'th seed', 't.h. seeds', 't.h.seeds', 't.h. seed', 't.h.seed')
`).run();

console.log('Updated strains:', updateStrains.changes);

const updateEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = 'T.H. Seeds'
  WHERE LOWER(extracted_breeder) IN ('th seeds', 'thseeds', 'th seed', 't.h. seeds', 't.h.seeds', 't.h. seed', 't.h.seed')
`).run();

console.log('Updated new_scraped_entries:', updateEntries.changes);
