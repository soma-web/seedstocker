import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const db = new Database(dbPath);

console.log('--- Offers for V and X ---');
const vxOffers = db.prepare(`
  SELECT s.id, s.name, s.breeder, o.shop, o.url, o.price, o.seeds
  FROM strains s
  JOIN scraped_offers o ON s.id = o.strain_id
  WHERE s.name IN ('V', 'X')
`).all();

console.table(vxOffers);

db.close();
