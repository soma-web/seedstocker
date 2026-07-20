import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const db = new Database(dbPath);

console.log('--- Additional DB Sanity Checks ---');

// Check nulls or empty strings
const emptyFields = db.prepare(`
  SELECT id, name, breeder FROM strains 
  WHERE name IS NULL OR name = '' OR breeder IS NULL OR breeder = ''
`).all();
console.log('Empty name/breeder count:', emptyFields.length);

// Check for numeric strain names or leading numbers without letters
const strangeStart = db.prepare(`
  SELECT id, name, breeder FROM strains 
  WHERE name GLOB '[0-9]*' AND name NOT GLOB '*[a-zA-Z]*'
`).all();
console.log('Purely numeric strain names count:', strangeStart.length);
if (strangeStart.length > 0) console.table(strangeStart);

db.close();
