import { sqlite } from '../server/src/db.js';

const fastBudsStrains = sqlite.prepare(`
  SELECT id, name, breeder, type, seed_type
  FROM strains
  WHERE LOWER(breeder) = '420 fast buds'
`).all();

console.log('420 Fast Buds Strains in DB:', fastBudsStrains);
