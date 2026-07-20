import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const db = new Database(dbPath);

console.log('Database loaded from:', dbPath);

const strains = db.prepare('SELECT id, name, breeder, created_at, updated_at FROM strains ORDER BY name ASC').all();
console.log(`Total strains in DB: ${strains.length}`);

const suspicious = [];

strains.forEach(s => {
  const name = s.name || '';
  const breeder = s.breeder || '';
  const reasons = [];

  // 1. HTML entities or encoding issues
  if (/&[a-z0-9#]+;/i.test(name)) reasons.push('Contains HTML entity');
  if (/[\uFFFDÃÂâï]/.test(name)) reasons.push('Potential encoding artifact');
  if (/[\r\n\t]/.test(name)) reasons.push('Contains newline or tab');
  if (name !== name.trim()) reasons.push('Has leading or trailing whitespace');
  
  // 2. Trailing single letter or suspicious trailing pattern (e.g. ending with standalone ' e' or ' E')
  if (/\s[eE]$/.test(name)) reasons.push("Ends with standalone 'e'/'E'");
  
  // 3. Generic shop / navigation words
  if (/^(home|shop|cart|search|seeds|samen|kaufen|buy|product|page|item|default|undefined|null|nan)$/i.test(name.trim())) {
    reasons.push('Generic/nav word');
  }
  if (/(feminisiert|autoflower|automatic|pack|stk|stück|seeds|samen|online|versand|kaufen|bestellen)/i.test(name) && !/mix/i.test(name)) {
    reasons.push('Contains German/English shop descriptor words in strain name');
  }
  
  // 4. URL / HTTP artifacts
  if (/(http|https|www|\.de|\.com|\.nl|\.lu|\.es)/i.test(name)) reasons.push('Contains URL domain/protocol');
  
  // 5. Length anomalies
  if (name.length < 3) reasons.push('Extremely short (<3 chars)');
  if (name.length > 50) reasons.push('Extremely long (>50 chars)');
  
  // 6. Suspicious characters
  if (/[{}<>[\]\\^~]/.test(name)) reasons.push('Contains unexpected brackets/symbols');
  
  // 7. Double spaces or weird formatting
  if (/\s{2,}/.test(name)) reasons.push('Contains consecutive spaces');

  if (reasons.length > 0) {
    suspicious.push({
      id: s.id,
      name: s.name,
      breeder: s.breeder,
      reasons: reasons.join(', ')
    });
  }
});

console.log(`\nFound ${suspicious.length} suspicious strains out of ${strains.length}:`);
console.log(JSON.stringify(suspicious, null, 2));

// Also let's group all strains by potential duplicate normalized names
const normalizedMap = new Map();
strains.forEach(s => {
  const norm = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normalizedMap.has(norm)) normalizedMap.set(norm, []);
  normalizedMap.get(norm).push(s);
});

const duplicates = [];
for (const [norm, list] of normalizedMap.entries()) {
  if (list.length > 1) {
    // Check if they have different original names or different breeders
    duplicates.push(list.map(x => `${x.name} (${x.breeder || 'No Breeder'}) [id:${x.id}]`));
  }
}

console.log(`\nPotential duplicate normalized names (${duplicates.length} groups):`);
console.log(JSON.stringify(duplicates.slice(0, 30), null, 2));
