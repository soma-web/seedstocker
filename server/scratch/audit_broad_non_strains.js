import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const db = new Database(dbPath);

const keywords = [
  'led', 'light', 'lamp', 'box', 'set', 'kit', 'shirt', 'hoodie', 'apparel',
  'bag', 'pot', 'tent', 'fan', 'filter', 'meter', 'scale', 'pen', 'paper', 'cone',
  'pipe', 'bong', 'vape', 'tray', 'ashtray', 'display', 'gutschein', 'card',
  'scissor', 'clipper', 'lighter', 'tube', 'jar', 'glass', 'nutrients', 'soil', 'coco'
];

const allStrains = db.prepare(`SELECT id, name, breeder, thc FROM strains ORDER BY name ASC`).all();

const matched = [];

for (const s of allStrains) {
  const n = s.name.toLowerCase();
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${kw}s?\\b`, 'i');
    if (regex.test(n)) {
      matched.push({ id: s.id, name: s.name, breeder: s.breeder, thc: s.thc, kw });
      break;
    }
  }
}

console.log(`Broad audit found ${matched.length} strains matching keywords:`);
console.table(matched);

db.close();
