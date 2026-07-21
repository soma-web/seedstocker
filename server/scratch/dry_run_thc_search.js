import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/seedstocker.db');
const outputPath = path.resolve(__dirname, '../data/proposed_thc_updates.json');

const db = new Database(dbPath);

// Regex patterns to capture THC percentage in text
const thcRegexes = [
  /THC\s*:\s*~?\s*(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?\s*%)/i,
  /THC\s*(?:content|gehalt|level|potency)?\s*(?:of|von|is|ist|:)?\s*~?\s*(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?\s*%)/i,
  /(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?\s*%)\s*THC/i,
  /up to\s*(\d{1,2}(?:\.\d+)?\s*%)\s*THC/i,
  /bis zu\s*(\d{1,2}(?:\.\d+)?\s*%)\s*THC/i,
  /(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?\s*%)/i
];

function cleanThcValue(raw) {
  if (!raw) return null;
  let val = raw.trim().replace(/\s+/g, '');
  // Extract number range or single percentage
  const m = val.match(/(\d{1,2}(?:\.\d+)?(?:-\d{1,2}(?:\.\d+)?)?%?)/);
  if (!m) return null;
  let res = m[1];
  if (!res.endsWith('%')) res += '%';
  
  // Sanity check numeric value
  const nums = res.replace('%', '').split('-').map(Number);
  if (nums.some(n => n <= 0 || n > 45)) return null;
  return res;
}

function searchInText(text) {
  if (!text) return null;
  for (const reg of thcRegexes) {
    const match = text.match(reg);
    if (match && match[1]) {
      const cleaned = cleanThcValue(match[1]);
      if (cleaned) return { val: cleaned, snippet: match[0] };
    }
  }
  return null;
}

async function searchDDG(strainName, breeder) {
  const query = `${breeder || ''} ${strainName} THC percentage`.trim();
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,de;q=0.8'
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    
    // Extract result snippets
    const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = regex.exec(html)) !== null) {
      const text = m[1].replace(/<[^>]+>/g, '').trim();
      const found = searchInText(text);
      if (found) {
        return { val: found.val, snippet: text, source: 'DuckDuckGo Search', query };
      }
    }
  } catch (err) {
    // Network or rate limit error
  }
  return null;
}

async function searchSeedfinder(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const found = searchInText(html);
    if (found) {
      return { val: found.val, snippet: found.snippet, source: 'Seedfinder URL', url };
    }
  } catch (err) {}
  return null;
}

async function main() {
  // Load existing results if resuming
  let results = [];
  if (fs.existsSync(outputPath)) {
    try {
      results = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      console.log(`Loaded ${results.length} existing results from ${outputPath}`);
    } catch {}
  }
  const processedIds = new Set(results.map(r => r.id));

  // Get missing THC strains
  const missingStrains = db.prepare(`
    SELECT s.id, s.name, s.breeder, s.seedfinder_url, d.description as shop_desc, r.description as rew_desc, a.description as ai_desc
    FROM strains s
    LEFT JOIN strain_shop_descriptions d ON s.id = d.strain_id
    LEFT JOIN rewritten_descriptions r ON s.id = r.strain_id
    LEFT JOIN ai_descriptions a ON s.id = a.strain_id
    WHERE s.thc IS NULL OR s.thc = '' OR s.thc = 'N/A' OR s.thc = 'Unknown' OR s.thc = '?'
  `).all();

  console.log(`Total strains missing THC: ${missingStrains.length}`);
  const remaining = missingStrains.filter(s => !processedIds.has(s.id));
  console.log(`Remaining to process: ${remaining.length}`);

  let foundCount = results.filter(r => r.proposedThc).length;
  let count = 0;

  for (const strain of remaining) {
    count++;
    let proposed = null;

    // Pass 1: Existing DB descriptions
    const dbText = [strain.shop_desc, strain.rew_desc, strain.ai_desc].filter(Boolean).join(' ');
    const fromDb = searchInText(dbText);
    if (fromDb) {
      proposed = {
        val: fromDb.val,
        snippet: fromDb.snippet,
        source: 'Existing DB Description'
      };
    }

    // Pass 2: Seedfinder URL if available
    if (!proposed && strain.seedfinder_url) {
      const fromSf = await searchSeedfinder(strain.seedfinder_url);
      if (fromSf) proposed = fromSf;
    }

    // Pass 3: DuckDuckGo Web Search
    if (!proposed) {
      const fromDdg = await searchDDG(strain.name, strain.breeder);
      if (fromDdg) proposed = fromDdg;
      // Sleep slightly for DDG rate limiting
      await new Promise(r => setTimeout(r, 1200));
    }

    const entry = {
      id: strain.id,
      name: strain.name,
      breeder: strain.breeder || 'Unknown',
      proposedThc: proposed ? proposed.val : null,
      source: proposed ? proposed.source : null,
      snippet: proposed ? proposed.snippet : null,
      checkedAt: new Date().toISOString()
    };

    results.push(entry);
    if (proposed) {
      foundCount++;
      console.log(`[${count}/${remaining.length}] FOUND for "${strain.name}" (${strain.breeder}): ${proposed.val} [Source: ${proposed.source}]`);
    } else {
      console.log(`[${count}/${remaining.length}] No THC found for "${strain.name}" (${strain.breeder})`);
    }

    // Periodically save to file
    if (count % 10 === 0 || count === remaining.length) {
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      console.log(`---> Saved progress (${results.length} total entries, ${foundCount} with proposed THC) to JSON.`);
    }
  }

  db.close();
  console.log(`\n=== DRY RUN COMPLETED ===`);
  console.log(`Total processed: ${results.length}`);
  console.log(`Total proposed THC values found: ${foundCount}`);
}

main().catch(console.error);
