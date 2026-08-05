import { sqlite } from '../server/src/db.js';

const rows = sqlite.prepare(`
  SELECT *
  FROM new_scraped_entries
  WHERE LOWER(extracted_name) LIKE '%gg4%' OR LOWER(raw_title) LIKE '%gg4%'
`).all();

console.log('Staging entries matching GG4:', rows);
