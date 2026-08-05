import { sqlite } from '../server/src/db.js';

const rowsStrains = sqlite.prepare(`
  SELECT DISTINCT breeder
  FROM strains
  WHERE LOWER(breeder) LIKE '%blim%'
`).all();

const rowsEntries = sqlite.prepare(`
  SELECT DISTINCT extracted_breeder
  FROM new_scraped_entries
  WHERE LOWER(extracted_breeder) LIKE '%blim%'
`).all();

console.log('Strains Breeders:', rowsStrains);
console.log('New Scraped Entries Breeders:', rowsEntries);
