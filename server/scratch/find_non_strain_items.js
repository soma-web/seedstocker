import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const outputPath = path.resolve(__dirname, '../data/suspected_non_strains.json');

const db = new Database(dbPath);

const allStrains = db.prepare(`
  SELECT s.id, s.name, s.breeder, s.thc, s.cbd, s.genetics, s.created_at
  FROM strains s
  ORDER BY s.name ASC
`).all();

// Whitelist of valid cannabis strains or strain components that contain equipment-like words
const strainWhitelistPatterns = [
  /cap\s*junky/i,
  /mac's\s*cap/i,
  /capulator/i,
  /northern\s*light/i,
  /black\s*light/i,
  /coco\s*fresh/i,
  /coco\s*milk/i,
  /mighty\s*dwarf/i,
  /mighty\s*bubble/i,
  /ziplock/i,
  /honey\s*pot/i,
  /pot\s*of\s*gold/i,
  /chamber/i,
  /box\s*strain/i,
  /paper\s*chase/i
];

// Strict Non-strain keyword regex patterns (English & German growshop/headshop gear, apparel, tools, nutrients)
const nonStrainPatterns = [
  { pattern: /\b(meter|messgerät|hygrometer|thermometer|ec\s*meter|ph\s*meter|pen|pro\s*pen|ec\s*pen|ph\s*pen|p110\s*pro|e50\s*pro)\b/i, reason: 'Measuring Device / Meter' },
  { pattern: /\b(scale|waage|grammwaage|feinwaage|digital\s*scale|cs3)\b/i, reason: 'Scales' },
  { pattern: /\b(fabric\s*pot|pflanzbehälter|stofftopf|jungle\s*bag|air-pot|bag\s*cover)\b/i, reason: 'Pots / Planting Containers' },
  { pattern: /\b(pruning|ernteschere|secateurs|scissors)\b/i, reason: 'Trimming / Pruning Tools' },
  { pattern: /\b(lighter|feuerzeug|torch|joint\s*tube|holder\s*tube|spiral\s*glas\s*tip)\b/i, reason: 'Smoker Accessories / Tubes' },
  { pattern: /\b(ashtray|aschenbecher|rolling\s*tray)\b/i, reason: 'Ashtrays / Trays' },
  { pattern: /\b(grinder|kräutermühle)\b/i, reason: 'Grinders' },
  { pattern: /\b(vaporizer|dry\s*herb\s*vape|storz|bickel|volcano|crafty|dynavap|atomizer)\b/i, reason: 'Vaporizer / Devices' },
  { pattern: /\b(activated\s*charcoal|aktivkohlefilter|rolling\s*paper)\b/i, reason: 'Rolling Papers / Filters' },
  { pattern: /\b(hoodie|t-shirt|apparel|merch|clothing|pullover)\b/i, reason: 'Apparel / Merchandise' },
  { pattern: /\b(cloudline|ventilator|exhaust|carbon\s*filter|growbox|pwr\s*led|gcx\s*\d|led\s*lamp|led\s*light|grow\s*tent)\b/i, reason: 'Grow Equipment / LEDs / Fans / Tents' },
  { pattern: /\b(fertilizer|dünger|nutrient|rootit|bacto|mycor|ph\s*down|ph\s*up)\b/i, reason: 'Nutrients / Fertilizer / Chemical' },
  { pattern: /\b(gutschein|gift\s*card|voucher|bodendisplay|counter\s*display|wooden\s*display)\b/i, reason: 'Displays / Vouchers' },
  { pattern: /\b(fermbag|dryferm|bag\s*3\s*pcs|fermentation)\b/i, reason: 'Fermentation / Curing Supplies' }
];

const suspected = [];

for (const strain of allStrains) {
  const name = strain.name || '';
  const breeder = strain.breeder || '';
  const nameLower = name.toLowerCase().trim();
  const breederLower = breeder.toLowerCase().trim();

  // Skip whitelisted strains
  if (strainWhitelistPatterns.some(p => p.test(nameLower) || p.test(breederLower))) {
    continue;
  }

  let matchedReason = null;

  // Check breeder
  if (breederLower === 'headshop' || breederLower === 'head shop' || breederLower === 'growshop') {
    matchedReason = 'Breeder is Headshop / Growshop';
  }

  // Check name patterns
  if (!matchedReason) {
    for (const rule of nonStrainPatterns) {
      if (rule.pattern.test(nameLower) || rule.pattern.test(breederLower)) {
        matchedReason = rule.reason;
        break;
      }
    }
  }

  if (matchedReason) {
    suspected.push({
      id: strain.id,
      name: strain.name,
      breeder: strain.breeder || 'Unknown',
      thc: strain.thc,
      cbd: strain.cbd,
      reason: matchedReason,
      createdAt: strain.created_at
    });
  }
}

fs.writeFileSync(outputPath, JSON.stringify(suspected, null, 2));

console.log(`\n=== REFINED NON-STRAIN DETECTION ===`);
console.log(`Total database strains scanned: ${allStrains.length}`);
console.log(`Suspected non-strain / merchandise items found: ${suspected.length}`);
console.log(`Output written to: ${outputPath}\n`);

if (suspected.length > 0) {
  console.table(suspected.map(s => ({ name: s.name, breeder: s.breeder, reason: s.reason })));
}

db.close();
