import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAllShopNames } from './scrapers/registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration list of offers or URL patterns to ignore in integrity checks
export const IGNORED_OFFERS = {
  // Offer IDs to ignore
  ids: [
    'd4001ec4-2ed0-4fc8-bd24-ab1eb8fdb70d',
    '8a701986-888f-4f54-b003-774138c2905f',
    'd08c0db5-57f8-46de-a68a-a2ffa8178bbb',
    '74751c0f-76eb-4525-8eab-e52d3414c6e6',
    '488f11f7-4810-4852-8686-e074f71cf4d9',
    '48905c45-1131-4ea7-82ec-6b97cfc35d56',
    'da8e878c-6782-4dc2-8856-d7c8a579e11e',
    'd4098112-7d69-45b4-909a-1e5002d07939',
    'f3f09fcc-76dc-43f6-b43e-ccead73869e2',
    'c8fb9e4d-e7ff-4c56-8b9d-4cef7a5d8246'
  ],
  // URL patterns/substrings to ignore (e.g. 'competition-box')
  urlPatterns: [
    'competition-box'
  ]
};

export function isOfferIgnored(offer) {
  if (!offer) return false;
  const id = typeof offer === 'string' ? offer : offer.id;
  const url = typeof offer === 'object' ? (offer.url || '') : '';
  if (id && IGNORED_OFFERS.ids.includes(id)) return true;
  if (url && IGNORED_OFFERS.urlPatterns && IGNORED_OFFERS.urlPatterns.some(pat => url.toLowerCase().includes(pat.toLowerCase()))) return true;
  return false;
}

// Helper to parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let dbPath = path.resolve(__dirname, '../data/seedstocker.db');
  let isJson = false;

  for (const arg of args) {
    if (arg.startsWith('--db=')) {
      dbPath = path.resolve(arg.split('=')[1]);
    } else if (arg === '--json') {
      isJson = true;
    }
  }

  return { dbPath, isJson };
}

export function runDbIntegrityCheck(dbPathOverride = null) {
  const defaultPath = path.resolve(__dirname, '../data/seedstocker.db');
  const targetDbPath = dbPathOverride || defaultPath;
  const db = new Database(targetDbPath);

  const suiteResults = {
    timestamp: new Date().toISOString(),
    dbPath: targetDbPath,
    totalChecks: 0,
    passedChecks: 0,
    failedChecks: 0,
    warningChecks: 0,
    results: []
  };

  function addCheck(name, category, status, message, details = []) {
    suiteResults.totalChecks++;
    if (status === 'PASS') suiteResults.passedChecks++;
    else if (status === 'FAIL') suiteResults.failedChecks++;
    else if (status === 'WARN') suiteResults.warningChecks++;

    suiteResults.results.push({
      name,
      category,
      status, // 'PASS' | 'FAIL' | 'WARN'
      message,
      count: details.length,
      details
    });
  }

  // -----------------------------------------------------------------
  // 1. STORAGE & RELATIONAL INTEGRITY
  // -----------------------------------------------------------------

  // SQLite PRAGMA integrity_check
  try {
    const integrityRes = db.prepare('PRAGMA integrity_check').all();
    const isOk = integrityRes.length === 1 && integrityRes[0].integrity_check === 'ok';
    if (isOk) {
      addCheck('SQLite B-Tree Integrity', 'Storage', 'PASS', 'Database file structure is healthy (integrity_check = ok)');
    } else {
      addCheck('SQLite B-Tree Integrity', 'Storage', 'FAIL', 'Database file corruption detected!', integrityRes);
    }
  } catch (err) {
    addCheck('SQLite B-Tree Integrity', 'Storage', 'FAIL', `Failed to execute integrity_check: ${err.message}`);
  }

  // SQLite PRAGMA foreign_key_check
  try {
    const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
    if (fkViolations.length === 0) {
      addCheck('Foreign Key Constraint Violations', 'Relational', 'PASS', 'Zero foreign key constraint violations');
    } else {
      addCheck('Foreign Key Constraint Violations', 'Relational', 'FAIL', `Found ${fkViolations.length} foreign key violation(s)`, fkViolations);
    }
  } catch (err) {
    addCheck('Foreign Key Constraint Violations', 'Relational', 'FAIL', `Failed to run foreign_key_check: ${err.message}`);
  }

  // Orphan Scraped Offers
  try {
    const orphanOffers = db.prepare(`
      SELECT o.id, o.strain_id, o.shop, o.price 
      FROM scraped_offers o 
      LEFT JOIN strains s ON o.strain_id = s.id 
      WHERE s.id IS NULL
    `).all();
    if (orphanOffers.length === 0) {
      addCheck('Orphan Offers', 'Relational', 'PASS', 'All scraped_offers reference a valid strain');
    } else {
      addCheck('Orphan Offers', 'Relational', 'FAIL', `Found ${orphanOffers.length} offer(s) referencing non-existent strain_id`, orphanOffers);
    }
  } catch (err) {
    addCheck('Orphan Offers', 'Relational', 'FAIL', `Check failed: ${err.message}`);
  }

  // Orphan Price History
  try {
    const orphanHistory = db.prepare(`
      SELECT h.id, h.strain_id, h.shop 
      FROM price_history h 
      LEFT JOIN strains s ON h.strain_id = s.id 
      WHERE s.id IS NULL
    `).all();
    if (orphanHistory.length === 0) {
      addCheck('Orphan Price History', 'Relational', 'PASS', 'All price_history records reference a valid strain');
    } else {
      addCheck('Orphan Price History', 'Relational', 'FAIL', `Found ${orphanHistory.length} price_history record(s) referencing non-existent strain_id`, orphanHistory);
    }
  } catch (err) {
    addCheck('Orphan Price History', 'Relational', 'FAIL', `Check failed: ${err.message}`);
  }

  // Orphan Strain Shop Descriptions
  try {
    const orphanDescs = db.prepare(`
      SELECT d.strain_id, d.shop 
      FROM strain_shop_descriptions d 
      LEFT JOIN strains s ON d.strain_id = s.id 
      WHERE s.id IS NULL
    `).all();
    if (orphanDescs.length === 0) {
      addCheck('Orphan Shop Descriptions', 'Relational', 'PASS', 'All strain_shop_descriptions reference a valid strain');
    } else {
      addCheck('Orphan Shop Descriptions', 'Relational', 'FAIL', `Found ${orphanDescs.length} description(s) referencing non-existent strain_id`, orphanDescs);
    }
  } catch (err) {
    addCheck('Orphan Shop Descriptions', 'Relational', 'FAIL', `Check failed: ${err.message}`);
  }

  // -----------------------------------------------------------------
  // 2. PRICING & ANOMALY CHECKS
  // -----------------------------------------------------------------

  // Price Ceiling (> 7000 EUR)
  try {
    const rawHighPrices = db.prepare(`
      SELECT id, strain_id, shop, price, seeds, url 
      FROM scraped_offers 
      WHERE price > 7000
    `).all();
    const highPrices = rawHighPrices.filter(o => !isOfferIgnored(o));
    if (highPrices.length === 0) {
      addCheck('Price Ceiling Check (<= 7000 €)', 'Pricing', 'PASS', 'No offers exceed the max threshold of 7000 €');
    } else {
      addCheck('Price Ceiling Check (<= 7000 €)', 'Pricing', 'FAIL', `Found ${highPrices.length} offer(s) exceeding 7000 € (likely missing decimal placement)`, highPrices);
    }
  } catch (err) {
    addCheck('Price Ceiling Check (<= 7000 €)', 'Pricing', 'FAIL', `Check failed: ${err.message}`);
  }

  // Price Floor (<= 0 EUR)
  try {
    const rawInvalidPrices = db.prepare(`
      SELECT id, strain_id, shop, price, url 
      FROM scraped_offers 
      WHERE price <= 0
    `).all();
    const invalidPrices = rawInvalidPrices.filter(o => !isOfferIgnored(o));
    if (invalidPrices.length === 0) {
      addCheck('Price Floor Check (> 0 €)', 'Pricing', 'PASS', 'All offers have a positive price');
    } else {
      addCheck('Price Floor Check (> 0 €)', 'Pricing', 'FAIL', `Found ${invalidPrices.length} offer(s) with zero or negative price`, invalidPrices);
    }
  } catch (err) {
    addCheck('Price Floor Check (> 0 €)', 'Pricing', 'FAIL', `Check failed: ${err.message}`);
  }

  // Price per Seed Sanity (0.10 € <= price/seeds <= 500 €)
  try {
    const rawExtremeRatios = db.prepare(`
      SELECT id, strain_id, shop, price, seeds, (price / seeds) as ratio, url 
      FROM scraped_offers 
      WHERE seeds > 0 AND ( (price / seeds) < 0.10 OR (price / seeds) > 500 )
    `).all();
    const extremeRatios = rawExtremeRatios.filter(o => !isOfferIgnored(o));
    if (extremeRatios.length === 0) {
      addCheck('Price Per Seed Sanity (0.10 € - 500 € / seed)', 'Pricing', 'PASS', 'All offer price-per-seed ratios fall within realistic bounds');
    } else {
      addCheck('Price Per Seed Sanity (0.10 € - 500 € / seed)', 'Pricing', 'WARN', `Found ${extremeRatios.length} offer(s) with suspicious price-per-seed ratios`, extremeRatios);
    }
  } catch (err) {
    addCheck('Price Per Seed Sanity', 'Pricing', 'FAIL', `Check failed: ${err.message}`);
  }

  // Seed Pack Size Validity (seeds <= 0)
  try {
    const rawInvalidSeeds = db.prepare(`
      SELECT id, strain_id, shop, seeds, price, url 
      FROM scraped_offers 
      WHERE seeds IS NULL OR seeds <= 0
    `).all();
    const invalidSeeds = rawInvalidSeeds.filter(o => !isOfferIgnored(o));
    if (invalidSeeds.length === 0) {
      addCheck('Seed Pack Size Validity (seeds > 0)', 'Pricing', 'PASS', 'All offers specify valid positive seed counts');
    } else {
      addCheck('Seed Pack Size Validity (seeds > 0)', 'Pricing', 'FAIL', `Found ${invalidSeeds.length} offer(s) with invalid seed pack counts`, invalidSeeds);
    }
  } catch (err) {
    addCheck('Seed Pack Size Validity', 'Pricing', 'FAIL', `Check failed: ${err.message}`);
  }

  // -----------------------------------------------------------------
  // 3. STRAIN & DATA QUALITY CHECKS
  // -----------------------------------------------------------------

  // Nameless Strains
  try {
    const namelessStrains = db.prepare(`
      SELECT id, breeder, created_at 
      FROM strains 
      WHERE name IS NULL OR TRIM(name) = ''
    `).all();
    if (namelessStrains.length === 0) {
      addCheck('Nameless Strains Check', 'Data Quality', 'PASS', 'All strains have a non-empty name');
    } else {
      addCheck('Nameless Strains Check', 'Data Quality', 'FAIL', `Found ${namelessStrains.length} nameless strain(s)`, namelessStrains);
    }
  } catch (err) {
    addCheck('Nameless Strains Check', 'Data Quality', 'FAIL', `Check failed: ${err.message}`);
  }

  // Non-Seed Accessory Products
  try {
    const accessoryWordRegex = /\b(ashtray|ashtrays|grinder|grinders|joint-holder|joint holder|joint-tube|joint tube|lighter|lighters|clipper|vaporizer|vaporizers|bong|bongs|ph-down|ph down|calmag|puffco|greenception|herbgarden|netztopf|gutschein|adventskalender)\b/i;

    const allOffers = db.prepare(`
      SELECT s.id, s.name, s.breeder, o.url, o.shop
      FROM strains s
      JOIN scraped_offers o ON s.id = o.strain_id
    `).all();

    const accessories = allOffers.filter(row =>
      accessoryWordRegex.test(row.name) || accessoryWordRegex.test(row.url)
    );

    if (accessories.length === 0) {
      addCheck('Non-Seed Accessory Products Detection', 'Data Quality', 'PASS', 'No non-seed merchandise detected in strains catalog');
    } else {
      addCheck('Non-Seed Accessory Products Detection', 'Data Quality', 'WARN', `Found ${accessories.length} item(s) that appear to be non-seed merchandise/accessories`, accessories);
    }
  } catch (err) {
    addCheck('Non-Seed Accessory Products Detection', 'Data Quality', 'FAIL', `Check failed: ${err.message}`);
  }

  // Invalid Offer URLs
  try {
    const invalidUrls = db.prepare(`
      SELECT id, strain_id, shop, url 
      FROM scraped_offers 
      WHERE url IS NULL OR (url NOT LIKE 'http://%' AND url NOT LIKE 'https://%')
    `).all();
    if (invalidUrls.length === 0) {
      addCheck('Offer URL Validity', 'Data Quality', 'PASS', 'All offer URLs are valid HTTP/HTTPS URLs');
    } else {
      addCheck('Offer URL Validity', 'Data Quality', 'FAIL', `Found ${invalidUrls.length} offer(s) with invalid URLs`, invalidUrls);
    }
  } catch (err) {
    addCheck('Offer URL Validity', 'Data Quality', 'FAIL', `Check failed: ${err.message}`);
  }

  // -----------------------------------------------------------------
  // 4. SCHEMA DOMAIN & RANGE CHECKS
  // -----------------------------------------------------------------

  // Strain Type Domain Validation
  try {
    const invalidTypes = db.prepare(`
      SELECT id, name, type 
      FROM strains 
      WHERE type IS NOT NULL AND type NOT IN ('photoperiodic', 'autoflower', 'fast_flowering', 'triploid')
    `).all();
    if (invalidTypes.length === 0) {
      addCheck('Strain Type Enum Domain', 'Schema', 'PASS', 'All specified strain types match valid enum values');
    } else {
      addCheck('Strain Type Enum Domain', 'Schema', 'FAIL', `Found ${invalidTypes.length} strain(s) with invalid type values`, invalidTypes);
    }
  } catch (err) {
    addCheck('Strain Type Enum Domain', 'Schema', 'FAIL', `Check failed: ${err.message}`);
  }

  // Seed Type Domain Validation
  try {
    const invalidSeedTypes = db.prepare(`
      SELECT id, name, seed_type 
      FROM strains 
      WHERE seed_type IS NOT NULL AND seed_type NOT IN ('feminized', 'regular')
    `).all();
    if (invalidSeedTypes.length === 0) {
      addCheck('Seed Type Enum Domain', 'Schema', 'PASS', 'All specified seed types match valid enum values');
    } else {
      addCheck('Seed Type Enum Domain', 'Schema', 'FAIL', `Found ${invalidSeedTypes.length} strain(s) with invalid seed_type values`, invalidSeedTypes);
    }
  } catch (err) {
    addCheck('Seed Type Enum Domain', 'Schema', 'FAIL', `Check failed: ${err.message}`);
  }

  // Availability Domain Validation
  try {
    const invalidAvail = db.prepare(`
      SELECT id, strain_id, shop, availability 
      FROM scraped_offers 
      WHERE availability NOT IN ('available', 'orderable', 'out_of_stock')
    `).all();
    if (invalidAvail.length === 0) {
      addCheck('Offer Availability Enum Domain', 'Schema', 'PASS', 'All offer availability statuses match valid enum values');
    } else {
      addCheck('Offer Availability Enum Domain', 'Schema', 'FAIL', `Found ${invalidAvail.length} offer(s) with invalid availability status`, invalidAvail);
    }
  } catch (err) {
    addCheck('Offer Availability Enum Domain', 'Schema', 'FAIL', `Check failed: ${err.message}`);
  }

  // Currency Validation
  try {
    const invalidCurrency = db.prepare(`
      SELECT id, strain_id, shop, currency 
      FROM scraped_offers 
      WHERE currency IS NULL OR currency != 'EUR'
    `).all();
    if (invalidCurrency.length === 0) {
      addCheck('Offer Currency Domain (EUR)', 'Schema', 'PASS', 'All offers use standard EUR currency');
    } else {
      addCheck('Offer Currency Domain (EUR)', 'Schema', 'WARN', `Found ${invalidCurrency.length} offer(s) with non-EUR currency`, invalidCurrency);
    }
  } catch (err) {
    addCheck('Offer Currency Domain (EUR)', 'Schema', 'FAIL', `Check failed: ${err.message}`);
  }

  // Strain Rating Bounds (0.0 to 5.0)
  try {
    const invalidRatings = db.prepare(`
      SELECT id, name, rating 
      FROM strains 
      WHERE rating IS NOT NULL AND (rating < 0.0 OR rating > 5.0)
    `).all();
    if (invalidRatings.length === 0) {
      addCheck('Strain Rating Bounds (0.0 - 5.0)', 'Schema', 'PASS', 'All ratings fall between 0.0 and 5.0');
    } else {
      addCheck('Strain Rating Bounds (0.0 - 5.0)', 'Schema', 'FAIL', `Found ${invalidRatings.length} strain(s) with out-of-range rating`, invalidRatings);
    }
  } catch (err) {
    addCheck('Strain Rating Bounds (0.0 - 5.0)', 'Schema', 'FAIL', `Check failed: ${err.message}`);
  }

  // Flowering Min/Max Range Sanity
  try {
    const invalidFlowering = db.prepare(`
      SELECT id, name, flowering_min, flowering_max 
      FROM strains 
      WHERE flowering_min IS NOT NULL AND flowering_max IS NOT NULL AND flowering_min > flowering_max
    `).all();
    if (invalidFlowering.length === 0) {
      addCheck('Flowering Min/Max Sanity', 'Schema', 'PASS', 'flowering_min is <= flowering_max for all strains');
    } else {
      addCheck('Flowering Min/Max Sanity', 'Schema', 'FAIL', `Found ${invalidFlowering.length} strain(s) where flowering_min > flowering_max`, invalidFlowering);
    }
  } catch (err) {
    addCheck('Flowering Min/Max Sanity', 'Schema', 'FAIL', `Check failed: ${err.message}`);
  }

  // -----------------------------------------------------------------
  // 5. DUPLICATES & AUDIT CHECKS
  // -----------------------------------------------------------------

  // Duplicate Offers Check
  try {
    const duplicateOffers = db.prepare(`
      SELECT strain_id, shop, seeds, COUNT(*) as dupCount 
      FROM scraped_offers 
      GROUP BY strain_id, shop, seeds 
      HAVING dupCount > 1
    `).all();
    if (duplicateOffers.length === 0) {
      addCheck('Duplicate Scraped Offers', 'Audit', 'PASS', 'No duplicate active offers for identical (strain_id, shop, seeds)');
    } else {
      addCheck('Duplicate Scraped Offers', 'Audit', 'WARN', `Found ${duplicateOffers.length} duplicate offer group(s)`, duplicateOffers);
    }
  } catch (err) {
    addCheck('Duplicate Scraped Offers', 'Audit', 'FAIL', `Check failed: ${err.message}`);
  }

  // Potential Duplicate Strains Check
  try {
    const duplicateStrains = db.prepare(`
      SELECT LOWER(TRIM(name)) as norm_name, LOWER(TRIM(COALESCE(breeder, ''))) as norm_breeder, COUNT(*) as dupCount, GROUP_CONCAT(id) as strain_ids 
      FROM strains 
      GROUP BY norm_name, norm_breeder 
      HAVING dupCount > 1
    `).all();
    if (duplicateStrains.length === 0) {
      addCheck('Duplicate Strain Entities', 'Audit', 'PASS', 'No strains share identical (name, breeder) combinations');
    } else {
      addCheck('Duplicate Strain Entities', 'Audit', 'WARN', `Found ${duplicateStrains.length} potential duplicate strain group(s)`, duplicateStrains);
    }
  } catch (err) {
    addCheck('Duplicate Strain Entities', 'Audit', 'FAIL', `Check failed: ${err.message}`);
  }
  // Shop Offer & Strain Presence Check
  try {
    const registeredShops = getAllShopNames();
    const missingShops = [];

    for (const shopName of registeredShops) {
      const stats = db.prepare(`
        SELECT COUNT(*) as offersCount, COUNT(DISTINCT strain_id) as strainsCount 
        FROM scraped_offers 
        WHERE shop = ?
      `).get(shopName);

      if (!stats || stats.offersCount === 0 || stats.strainsCount === 0) {
        missingShops.push({
          shop: shopName,
          strainsCount: stats ? stats.strainsCount : 0,
          offersCount: stats ? stats.offersCount : 0
        });
      }
    }

    if (missingShops.length === 0) {
      addCheck('Shop Offer & Strain Presence', 'Audit', 'PASS', 'Every registered shop has at least 1 strain and 1 offer in the database');
    } else {
      addCheck('Shop Offer & Strain Presence', 'Audit', 'WARN', `Found ${missingShops.length} registered shop(s) with 0 strains or 0 offers`, missingShops);
    }
  } catch (err) {
    addCheck('Shop Offer & Strain Presence', 'Audit', 'FAIL', `Check failed: ${err.message}`);
  }

  db.close();
  return suiteResults;
}

// Format colored console output for CLI execution
function renderCliOutput(suiteResults) {
  console.log('\n======================================================');
  console.log('   SEEDSTOCKER SQLITE DATABASE INTEGRITY & AUDIT TEST  ');
  console.log('======================================================');
  console.log(`Database File : ${suiteResults.dbPath}`);
  console.log(`Timestamp     : ${suiteResults.timestamp}`);
  console.log(`Total Checks  : ${suiteResults.totalChecks}`);
  console.log(`Passed        : ${suiteResults.passedChecks}`);
  console.log(`Failed        : ${suiteResults.failedChecks}`);
  console.log(`Warnings      : ${suiteResults.warningChecks}\n`);

  for (const check of suiteResults.results) {
    let icon = '[PASS]';
    if (check.status === 'FAIL') icon = '\x1b[31m[FAIL]\x1b[0m';
    else if (check.status === 'WARN') icon = '\x1b[33m[WARN]\x1b[0m';
    else icon = '\x1b[32m[PASS]\x1b[0m';

    console.log(`${icon} [${check.category}] ${check.name}`);
    console.log(`       Message: ${check.message}`);

    if (check.details.length > 0 && (check.status === 'FAIL' || check.status === 'WARN')) {
      const displayCount = Math.min(check.details.length, 3);
      console.log(`       Sample Findings (${displayCount} of ${check.details.length}):`);
      for (let i = 0; i < displayCount; i++) {
        console.log(`         - `, check.details[i]);
      }
    }
    console.log('');
  }

  console.log('------------------------------------------------------');
  if (suiteResults.failedChecks > 0) {
    console.log('\x1b[31mRESULT: FAILED - Integrity violations found.\x1b[0m\n');
  } else if (suiteResults.warningChecks > 0) {
    console.log('\x1b[33mRESULT: PASSED WITH WARNINGS\x1b[0m\n');
  } else {
    console.log('\x1b[32mRESULT: ALL CHECKS PASSED PERFECTLY\x1b[0m\n');
  }
}

// Execute CLI runner if run directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('test-db-integrity.js')) {
  const { dbPath, isJson } = parseArgs();
  const results = runDbIntegrityCheck(dbPath);

  if (isJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    renderCliOutput(results);
  }

  // Exit with non-zero if critical failures occurred
  if (results.failedChecks > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
