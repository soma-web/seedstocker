import { sqlite } from '../server/src/db.js';

const updateStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = 'Blimburn Seeds'
  WHERE LOWER(breeder) IN ('blimburn seeds', 'blim burn seeds', 'blimburn', 'blimburnseeds', 'blim burn', 'blimburn seed', 'blim burn seed')
`).run();

console.log('Updated strains:', updateStrains.changes);

const updateEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = 'Blimburn Seeds'
  WHERE LOWER(extracted_breeder) IN ('blimburn seeds', 'blim burn seeds', 'blimburn', 'blimburnseeds', 'blim burn', 'blimburn seed', 'blim burn seed')
`).run();

console.log('Updated new_scraped_entries:', updateEntries.changes);
