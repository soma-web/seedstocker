import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const db = new Database(dbPath);

const headshopStrains = db.prepare(`
  SELECT id, name, breeder FROM strains WHERE LOWER(breeder) = 'headshop'
`).all();

console.log('Total Headshop strains count:', headshopStrains.length);
console.log('Sample Headshop strains:');
console.table(headshopStrains.slice(0, 15));

const shops = db.prepare(`
  SELECT shop, COUNT(*) as count 
  FROM scraped_offers 
  WHERE strain_id IN (SELECT id FROM strains WHERE LOWER(breeder) = 'headshop')
  GROUP BY shop
`).all();

console.log('\nShops offering Headshop items:');
console.table(shops);

db.close();
