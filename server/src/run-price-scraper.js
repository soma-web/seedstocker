import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sqlite, db } from './db.js';
import { initializeDatabase } from './migrations.js';
import { SCRAPER_REGISTRY, getScraperByName } from './scrapers/registry.js';
import { scrapedOffers } from './schema.js';
import { eq } from 'drizzle-orm';
import { getConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log directories & files
const logsDir = path.resolve(__dirname, '../logs');
fs.mkdirSync(logsDir, { recursive: true });

const errorsLogPath = path.join(logsDir, 'errors_and_warnings.txt');
const pricesLogPath = path.join(logsDir, 'scraped_prices.txt');
const skippedStrainsLogPath = path.join(logsDir, 'skipped_strains.txt');
const skippedShopItemsLogPath = path.join(logsDir, 'skipped_shop_items.txt');
const generalLogPath = path.resolve(__dirname, '../data/scraper.log');

// Metrics counter
const metrics = {
  startTime: Date.now(),
  endTime: null,
  priceCount: 0,
  skippedStrainsCount: 0,
  skippedShopItemsCount: 0,
  errorCount: 0,
  warningCount: 0,
  invalidCount: 0,
  shopsProcessed: [],
  shopsSkipped: []
};

// Ensure log files exist or header written
if (!fs.existsSync(errorsLogPath)) {
  fs.writeFileSync(errorsLogPath, `# SeedStocker Scraper Errors & Warnings Log\n# Created: ${new Date().toISOString()}\n\n`, 'utf8');
}
if (!fs.existsSync(pricesLogPath)) {
  fs.writeFileSync(pricesLogPath, `# SeedStocker Scraped Prices Log\n# Created: ${new Date().toISOString()}\n\n`, 'utf8');
}
if (!fs.existsSync(skippedStrainsLogPath)) {
  fs.writeFileSync(skippedStrainsLogPath, `# SeedStocker Skipped Strains Log (Unknown in DB during price mode)\n# Created: ${new Date().toISOString()}\n\n`, 'utf8');
}
if (!fs.existsSync(skippedShopItemsLogPath)) {
  fs.writeFileSync(skippedShopItemsLogPath, `# SeedStocker Skipped Shop Items Log (Merchandise, Accessories, Blocked Words, Bundles)\n# Created: ${new Date().toISOString()}\n\n`, 'utf8');
}

// Global logger for CLI process
function logMessage(type, message) {
  const timestamp = new Date().toISOString();
  const tag = type.toUpperCase();
  const consoleLine = `[${timestamp}][Scraper][${tag}] ${message}`;

  if (type === 'error') metrics.errorCount++;
  if (type === 'warning') metrics.warningCount++;
  if (type === 'invalid') metrics.invalidCount++;
  if (type === 'price') metrics.priceCount++;

  // Track & categorize skipped strains vs non-seed shop items
  const isSkipping = message.includes('Skipping') && !message.includes('Skipping shop');
  if (isSkipping) {
    const isUnknownStrain = message.includes('not in database') || message.includes('unknown strain') || message.includes('new offer for strain');
    
    if (isUnknownStrain) {
      metrics.skippedStrainsCount++;
      try {
        fs.appendFileSync(skippedStrainsLogPath, `[${timestamp}][SKIPPED_STRAIN] ${message}\n`, 'utf8');
      } catch (err) {
        console.error(`Failed to write to ${skippedStrainsLogPath}: ${err.message}`);
      }
    } else {
      metrics.skippedShopItemsCount++;
      try {
        fs.appendFileSync(skippedShopItemsLogPath, `[${timestamp}][SKIPPED_SHOP_ITEM] ${message}\n`, 'utf8');
      } catch (err) {
        console.error(`Failed to write to ${skippedShopItemsLogPath}: ${err.message}`);
      }
    }
  }

  console.log(consoleLine);

  const fileLine = `[${timestamp}][${tag}] ${message}\n`;

  // Write errors, warnings, and invalid entries to errors_and_warnings.txt
  if (type === 'error' || type === 'warning' || type === 'invalid') {
    try {
      fs.appendFileSync(errorsLogPath, fileLine, 'utf8');
    } catch (err) {
      console.error(`Failed to write to ${errorsLogPath}: ${err.message}`);
    }
  }

  // Write price updates/inserts to scraped_prices.txt
  if (type === 'price') {
    try {
      fs.appendFileSync(pricesLogPath, fileLine, 'utf8');
    } catch (err) {
      console.error(`Failed to write to ${pricesLogPath}: ${err.message}`);
    }
  }

  // Append to general log
  try {
    fs.appendFileSync(generalLogPath, consoleLine + '\n', 'utf8');
  } catch {}
}

// Format duration helper
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

// Print summary report
function printSummaryReport(options) {
  metrics.endTime = Date.now();
  const durationStr = formatDuration(metrics.endTime - metrics.startTime);

  let totalStrains = 0;
  let totalOffers = 0;
  let totalHistory = 0;

  try {
    totalStrains = sqlite.prepare('SELECT COUNT(*) AS count FROM strains').get()?.count || 0;
    totalOffers = sqlite.prepare('SELECT COUNT(*) AS count FROM scraped_offers').get()?.count || 0;
    totalHistory = sqlite.prepare('SELECT COUNT(*) AS count FROM price_history').get()?.count || 0;
  } catch (err) {
    console.error('Failed to query DB stats for summary report:', err.message);
  }

  const lines = [
    '================================================================================',
    '                        SCRAPER EXECUTION SUMMARY REPORT                        ',
    '================================================================================',
    ` Started At        : ${new Date(metrics.startTime).toISOString()}`,
    ` Finished At       : ${new Date(metrics.endTime).toISOString()}`,
    ` Total Duration    : ${durationStr}`,
    ` Scrape Mode       : ${options.mode}`,
    ` Target Filter     : ${options.targetShop || 'ALL Registered Shops'}`,
    '',
    ' --- WORKFLOW & METRICS ---',
    ` Shops Processed   : ${metrics.shopsProcessed.length} (${metrics.shopsProcessed.join(', ') || 'None'})`,
    ` Shops Skipped     : ${metrics.shopsSkipped.length}`,
    ` Prices Recorded   : ${metrics.priceCount}`,
    ` Skipped Strains   : ${metrics.skippedStrainsCount} (see skipped_strains.txt)`,
    ` Skipped Shop Items: ${metrics.skippedShopItemsCount} (see skipped_shop_items.txt)`,
    ` Warnings          : ${metrics.warningCount}`,
    ` Errors            : ${metrics.errorCount}`,
    '',
    ' --- DATABASE CATALOG SNAPSHOT ---',
    ` Total Strains     : ${totalStrains.toLocaleString('de-DE')}`,
    ` Active Offers     : ${totalOffers.toLocaleString('de-DE')}`,
    ` Price History     : ${totalHistory.toLocaleString('de-DE')}`,
    '',
    ' --- LOG FILES ---',
    ` Scraper Log       : ${generalLogPath}`,
    ` Price Log         : ${pricesLogPath}`,
    ` Skipped Strains   : ${skippedStrainsLogPath}`,
    ` Skipped Shop Items: ${skippedShopItemsLogPath}`,
    ` Error Log         : ${errorsLogPath}`,
    '================================================================================'
  ];

  const summaryText = '\n' + lines.join('\n') + '\n';
  console.log(summaryText);

  try {
    fs.appendFileSync(generalLogPath, summaryText, 'utf8');
  } catch {}
}

// Help & Option parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    targetShop: null,
    mode: 'price',
    help: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--shop=')) {
      options.targetShop = arg.split('=')[1].replace(/^["']|["']$/g, '').trim();
    } else if (arg === '-s' || arg === '--shop') {
      const idx = args.indexOf(arg);
      if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('-')) {
        options.targetShop = args[idx + 1].replace(/^["']|["']$/g, '').trim();
      }
    } else if (arg.startsWith('--mode=')) {
      options.mode = arg.split('=')[1].trim();
    } else if (arg === '-m' || arg === '--mode') {
      const idx = args.indexOf(arg);
      if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('-')) {
        options.mode = args[idx + 1].trim();
      }
    }
  }

  return options;
}

function showHelp() {
  console.log(`
SeedStocker Background Price Scraper CLI
=========================================
Usage: node server/src/run-price-scraper.js [options]

Options:
  --shop=<name>, -s <name>   Scrape specific shop only (e.g. "Zamnesia", "Hans Brainfood", "Dutch Passion")
  --mode=<mode>, -m <mode>   Scrape mode: 'price' (default), 'price_quick', 'full', or 'discovery'
  --help, -h                 Show this help screen

Output Log Files:
  - Errors & Warnings:  server/logs/errors_and_warnings.txt
  - Scraped Prices:     server/logs/scraped_prices.txt
  - General Logs:       server/data/scraper.log
`);
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  logMessage('info', '==================================================');
  logMessage('info', `Starting Background Price Scraper CLI (Mode: ${options.mode})...`);
  if (options.targetShop) {
    logMessage('info', `Target Shop Filter: "${options.targetShop}"`);
  } else {
    logMessage('info', 'Targeting ALL registered shops.');
  }
  logMessage('info', `Errors & Warnings log: ${errorsLogPath}`);
  logMessage('info', `Scraped Prices log:     ${pricesLogPath}`);
  logMessage('info', '==================================================');

  // Initialize DB schema & migrations
  try {
    initializeDatabase(sqlite);
    logMessage('info', 'Database initialized successfully.');
  } catch (err) {
    logMessage('error', `Database initialization failed: ${err.message}`);
    process.exit(1);
  }

  const config = getConfig();
  const statusObj = {
    isScanning: true,
    startTime: new Date().toISOString(),
    endTime: null,
    currentShop: null,
    currentProduct: null,
    productsScraped: 0,
    logs: []
  };

  try {
    for (const entry of SCRAPER_REGISTRY) {
      if (options.targetShop && entry.name.toLowerCase() !== options.targetShop.toLowerCase()) {
        logMessage('info', `Skipping shop "${entry.name}" (filter mismatch).`);
        metrics.shopsSkipped.push(entry.name);
        continue;
      }

      metrics.shopsProcessed.push(entry.name);
      statusObj.currentShop = entry.name;
      logMessage('info', `>>> Starting scraping for shop: "${entry.name}" (mode: ${options.mode})`);

      const scraper = new entry.ScraperClass(logMessage, options.mode);

      if (options.mode === 'price_quick') {
        logMessage('info', `Querying stored URLs for quick price scrape on ${entry.name}...`);
        const stored = await db.select({ url: scrapedOffers.url })
          .from(scrapedOffers)
          .where(eq(scrapedOffers.shop, entry.name));

        const uniqueUrls = [...new Set(stored.map(o => o.url))];
        logMessage('info', `Found ${uniqueUrls.length} stored URLs for ${entry.name}.`);

        let count = 0;
        for (const url of uniqueUrls) {
          try {
            statusObj.currentProduct = url;
            await scraper.scrapeSingle(url);
            count++;
            statusObj.productsScraped = count;
          } catch (err) {
            logMessage('error', `Failed scraping URL ${url}: ${err.message}`);
          }
          await scraper.sleep(300);
        }
        logMessage('info', `Completed quick price scrape for ${entry.name} (${count}/${uniqueUrls.length} processed).`);
      } else {
        const shopConfig = config.shops ? config.shops.find(s => (typeof s === 'string' ? s : s?.name)?.toLowerCase() === entry.name.toLowerCase()) : null;
        const targetUrl = (shopConfig && typeof shopConfig !== 'string' && shopConfig.url) ? shopConfig.url : (entry.defaultUrl || null);

        await scraper.scrape(statusObj, targetUrl);
      }
    }
  } catch (err) {
    logMessage('error', `Scraper task failed unexpectedly: ${err.message}\n${err.stack}`);
  } finally {
    statusObj.isScanning = false;
    statusObj.endTime = new Date().toISOString();
    printSummaryReport(options);
  }
}

main();
