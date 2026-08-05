import { sqlite } from '../server/src/db.js';

const strains = sqlite.prepare(`
  SELECT * FROM strains WHERE LOWER(name) LIKE '%gg4%' OR LOWER(name) LIKE '%sherbet%'
`).all();

console.log('Strains matching GG4/Sherbet:', strains);

const offers = sqlite.prepare(`
  SELECT * FROM scraped_offers WHERE LOWER(url) LIKE '%gg4%'
`).all();

console.log('Offers matching GG4:', offers);

const entries = sqlite.prepare(`
  SELECT * FROM new_scraped_entries WHERE LOWER(raw_data) LIKE '%gg4%' OR LOWER(extracted_name) LIKE '%gg4%'
`).all();

console.log('Entries matching GG4:', entries);
