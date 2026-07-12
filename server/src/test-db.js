import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');

const db = new Database(dbPath);
const strainsCount = db.prepare('SELECT COUNT(*) AS count FROM strains').get();
const offersCount = db.prepare('SELECT COUNT(*) AS count FROM scraped_offers').get();

console.log('Strains count in database:', strainsCount.count);
console.log('Offers count in database:', offersCount.count);

// Sample first 5 strains
const samples = db.prepare('SELECT * FROM strains LIMIT 5').all();
console.log('Sample strains:', samples);
