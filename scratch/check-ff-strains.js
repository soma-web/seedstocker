import { sqlite } from '../server/src/db.js';

const rows = sqlite.prepare(`
  SELECT id, name, breeder, type, seed_type
  FROM strains
  WHERE name LIKE '% FF' OR name LIKE '% Fast' OR name LIKE '% Fast Version' OR name LIKE '% Fast Flowering'
`).all();

console.log('Strains with FF/Fast in name:', rows);
