import { sqlite } from '../server/src/db.js';

const res = sqlite.prepare(`
  UPDATE strains
  SET type = 'fast_flowering'
  WHERE LOWER(breeder) = '420 fast buds' AND name LIKE '% FF' AND type != 'fast_flowering'
`).run();

console.log('Updated 420 Fast Buds FF strains to fast_flowering:', res.changes);
