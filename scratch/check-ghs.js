import { sqlite } from '../server/src/db.js';

const rowsStrains = sqlite.prepare(`
  SELECT DISTINCT breeder, COUNT(*) as count
  FROM strains
  WHERE LOWER(breeder) LIKE '%green%house%'
  GROUP BY breeder
`).all();

const rowsEntries = sqlite.prepare(`
  SELECT DISTINCT extracted_breeder, COUNT(*) as count
  FROM new_scraped_entries
  WHERE LOWER(extracted_breeder) LIKE '%green%house%'
  GROUP BY extracted_breeder
`).all();

console.log('Strains Breeders:', rowsStrains);
console.log('New Scraped Entries Breeders:', rowsEntries);
