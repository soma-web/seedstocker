import { sqlite } from '../server/src/db.js';

const strains = sqlite.prepare(`
  SELECT * FROM strains WHERE LOWER(name) LIKE '%sherbet%'
`).all();

console.log('Strains matching Sherbet:', strains.map(s => ({ id: s.id, name: s.name, breeder: s.breeder, seed_type: s.seed_type })));

const entries = sqlite.prepare(`
  SELECT * FROM new_scraped_entries WHERE extracted_name LIKE '%sherbet%' OR extracted_name LIKE '%gg4%'
`).all();

console.log('New Scraped Entries:', entries.map(e => ({ name: e.extracted_name, breeder: e.extracted_breeder, seed_type: e.seed_type, shop: e.shop_name })));
