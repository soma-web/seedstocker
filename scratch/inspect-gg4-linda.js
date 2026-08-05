import { sqlite } from '../server/src/db.js';

const rows = sqlite.prepare(`
  SELECT o.*, s.id as strain_id, s.name as strain_name, s.breeder, s.type, s.seed_type
  FROM scraped_offers o
  JOIN strains s ON o.strain_id = s.id
  WHERE LOWER(o.url) LIKE '%gg4-sherbet%' OR LOWER(s.name) LIKE '%gg4 sherbet%'
`).all();

console.log('Matching offers & strains:', rows);
