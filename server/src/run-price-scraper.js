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
const generalLogPath = path.resolve(__dirname, '../data/scraper.log');

// Ensure log files exist or header written
if (!fs.existsSync(errorsLogPath)) {
  fs.writeFileSync(errorsLogPath, `# SeedStocker Scraper Errors & Warnings Log\n# Created: ${new Date().toISOString()}\n\n`, 'utf8');
}
if (!fs.existsSync(pricesLogPath)) {
  fs.writeFileSync(pricesLogPath, `# SeedStocker Scraped Prices Log\n# Created: ${new Date().toISOString()}\n\n`, 'utf8');
}

// Global logger for CLI process
function logMessage(type, message) {
  const timestamp = new Date().toISOString();
  const tag = type.toUpperCase();
  const consoleLine = `[${timestamp}][Scraper][${tag}] ${message}`;
  
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
        continue;
      }

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

    logMessage('info', '==================================================');
    logMessage('info', 'Background Price Scraper execution completed successfully!');
    logMessage('info', '==================================================');
  } catch (err) {
    logMessage('error', `Scraper task failed unexpectedly: ${err.message}\n${err.stack}`);
  } finally {
    statusObj.isScanning = false;
    statusObj.endTime = new Date().toISOString();
  }
}

main();
