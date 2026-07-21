import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const db = new Database(dbPath);

const rawStrains = db.prepare(`
  SELECT id, name, breeder 
  FROM strains 
  WHERE LOWER(name) LIKE '%raw%' OR LOWER(breeder) LIKE '%raw%'
`).all();

console.log(`Found ${rawStrains.length} strains matching "raw":`);
console.table(rawStrains);

db.close();
