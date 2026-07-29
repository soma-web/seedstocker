import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    const highPrices = db.prepare(`
      SELECT id, strain_id, shop, price, seeds, url 
      FROM scraped_offers 
      WHERE price > 7000
    `).all();
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
    const invalidPrices = db.prepare(`
      SELECT id, strain_id, shop, price, url 
      FROM scraped_offers 
      WHERE price <= 0
    `).all();
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
    const extremeRatios = db.prepare(`
      SELECT id, strain_id, shop, price, seeds, (price / seeds) as ratio, url 
      FROM scraped_offers 
      WHERE seeds > 0 AND ( (price / seeds) < 0.10 OR (price / seeds) > 500 )
    `).all();
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
    const invalidSeeds = db.prepare(`
      SELECT id, strain_id, shop, seeds, price, url 
      FROM scraped_offers 
      WHERE seeds IS NULL OR seeds <= 0
    `).all();
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
    const nonSeedKeywords = [
      '%paper%', '%joint%', '%grinder%', '%tube%', '%bag%', '%tray%', '%lighter%',
      '%blunt%', '%filter%', '%bong%', '%pipe%', '%clipper%', '%vaporizer%'
    ];
    const query = `
      SELECT s.id, s.name, s.breeder, o.url, o.shop
      FROM strains s
      JOIN scraped_offers o ON s.id = o.strain_id
      WHERE ` + nonSeedKeywords.map(() => `(LOWER(s.name) LIKE ? OR LOWER(o.url) LIKE ?)`).join(' OR ');

    const bindParams = nonSeedKeywords.flatMap(k => [k, k]);
    const accessories = db.prepare(query).all(...bindParams);

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

  // Strains Without Offers Check
  try {
    const strainsWithoutOffers = db.prepare(`
      SELECT s.id, s.name, s.breeder 
      FROM strains s 
      LEFT JOIN scraped_offers o ON s.id = o.strain_id 
      WHERE o.id IS NULL
    `).all();
    if (strainsWithoutOffers.length === 0) {
      addCheck('Strains Without Offers', 'Audit', 'PASS', 'Every strain in the database has at least 1 scraped offer');
    } else {
      addCheck('Strains Without Offers', 'Audit', 'WARN', `Found ${strainsWithoutOffers.length} strain(s) with zero active scraped offers`, strainsWithoutOffers);
    }
  } catch (err) {
    addCheck('Strains Without Offers', 'Audit', 'FAIL', `Check failed: ${err.message}`);
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
