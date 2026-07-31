import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sqlite, db } from './db.js';
import { initializeDatabase } from './migrations.js';
import { SCRAPER_REGISTRY, getScraperByName, getScraperByDomain, getAllShopNames } from './scrapers/registry.js';
import { scrapedOffers, priceHistory } from './schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { BaseScraper } from './scrapers/BaseScraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log directories & files
const logsDir = path.resolve(__dirname, '../logs');
fs.mkdirSync(logsDir, { recursive: true });

const errorsLogPath = path.join(logsDir, 'errors_and_warnings.txt');
const pricesLogPath = path.join(logsDir, 'scraped_prices.txt');
const generalLogPath = path.resolve(__dirname, '../data/scraper.log');

// Truncate/reset log files before starting execution
function initLogFiles() {
  for (const filePath of [errorsLogPath, pricesLogPath, generalLogPath]) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, '', 'utf8');
    } catch { }
  }
}

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    targetShop: null,
    targetUrl: null,
    limit: null,
    maxAgeHours: null,
    concurrency: 3,
    dryRun: false
  };

  for (const arg of args) {
    if (arg.startsWith('--shop=')) {
      options.targetShop = arg.split('=')[1].replace(/^["']|["']$/g, '').trim();
    } else if (arg.startsWith('--url=')) {
      options.targetUrl = arg.split('=')[1].replace(/^["']|["']$/g, '').trim();
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10) || null;
    } else if (arg.startsWith('--max-age-hours=')) {
      options.maxAgeHours = parseFloat(arg.split('=')[1]) || null;
    } else if (arg.startsWith('--concurrency=')) {
      options.concurrency = parseInt(arg.split('=')[1], 10) || 3;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

// Metrics tracking
const metrics = {
  startTime: Date.now(),
  endTime: null,
  urlsProcessed: 0,
  urlsFailed: 0,
  urlsNotFound: 0,
  pricesUpdated: 0,
  offersOutOfStock: 0,
  errorCount: 0,
  warningCount: 0
};

// Global logger
function logMessage(type, message) {
  const timestamp = new Date().toISOString();
  const tag = type.toUpperCase();
  const consoleLine = `[${timestamp}][URL-Scraper][${tag}] ${message}`;

  if (type === 'error') metrics.errorCount++;
  if (type === 'warning') metrics.warningCount++;
  if (type === 'price') metrics.pricesUpdated++;

  console.log(consoleLine);

  const fileLine = `[${timestamp}][${tag}] ${message}\n`;

  if (type === 'error' || type === 'warning') {
    try {
      fs.appendFileSync(errorsLogPath, fileLine, 'utf8');
    } catch { }
  }
  if (type === 'price') {
    try {
      fs.appendFileSync(pricesLogPath, fileLine, 'utf8');
    } catch { }
  }
  try {
    fs.appendFileSync(generalLogPath, consoleLine + '\n', 'utf8');
  } catch { }
}

// Helper to parse seeds count from titles/options
function parseSeedsCount(text) {
  if (!text) return null;
  const str = String(text).toLowerCase();

  // Regex patterns for seed counts
  const match = str.match(/(\d+)[\s-]*(?:samen|seeds|stk|stück|stk\.|pk|pack|er|x)/i) ||
    str.match(/pack(?:ung)?[\s-]*(?:von|of)?[\s-]*(\d+)/i) ||
    str.match(/^(\d+)$/);

  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0 && num <= 1000) {
      return num;
    }
  }
  return null;
}

// Parse Shopify product JSON
async function fetchShopifyProductJson(url) {
  try {
    const cleanUrl = url.split('?')[0].replace(/\/$/, '');
    const jsonUrl = encodeURI(cleanUrl.endsWith('.json') ? cleanUrl : `${cleanUrl}.json`);

    const res = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (res.status === 404 || res.status === 410) {
      return { isNotFound: true, variants: [] };
    }

    if (!res.ok) {
      return null;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return null;
    }

    const data = await res.json();
    if (!data || !data.product || !Array.isArray(data.product.variants)) {
      return null;
    }

    const variants = [];
    const getSeedCount = (txt) => {
      if (!txt) return null;
      if (scraperInst && typeof scraperInst.parseSeedCount === 'function') {
        return scraperInst.parseSeedCount(txt);
      }
      return parseSeedsCount(txt);
    };

    const productTitleSeeds = getSeedCount(data.product.title);

    for (const v of data.product.variants) {
      const price = parseFloat(v.price);
      if (isNaN(price) || price <= 0) continue;

      const seedsFromOption = getSeedCount(v.option1) || getSeedCount(v.title);
      const titleText = `${v.title || ''} ${v.option1 || ''} ${v.name || ''}`;
      const seeds = seedsFromOption || getSeedCount(titleText) || productTitleSeeds;
      const available = v.available !== false ? 'available' : 'out_of_stock';

      variants.push({
        seeds,
        price,
        availability: available,
        variantTitle: v.title
      });
    }

    return { isNotFound: false, variants };
  } catch (err) {
    return null;
  }
}

// Parse HTML Schema.org JSON-LD for non-Shopify sites
async function fetchHtmlJsonLd(url) {
  try {
    const encodedUrl = encodeURI(url);
    const res = await fetch(encodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (res.status === 404 || res.status === 410) {
      return { isNotFound: true, offers: [] };
    }

    if (!res.ok) {
      return null;
    }

    const html = await res.text();
    const jsonLdMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

    const offers = [];

    for (const m of jsonLdMatches) {
      try {
        const rawJson = m[1].trim();
        const parsed = JSON.parse(rawJson);
        const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);

        for (const item of items) {
          if (!item) continue;
          const type = item['@type'];
          if (type === 'Product' || type === 'ProductGroup' || type === 'IndividualProduct') {
            const rawOffers = Array.isArray(item.offers) ? item.offers : (item.offers ? [item.offers] : []);

            for (const offer of rawOffers) {
              if (!offer) continue;
              const priceVal = offer.price || offer.lowPrice;
              const price = parseFloat(priceVal);
              if (isNaN(price) || price <= 0) continue;

              const availStr = String(offer.availability || '').toLowerCase();
              const availability = (availStr.includes('instock') || availStr.includes('in_stock')) ? 'available' :
                (availStr.includes('outofstock') || availStr.includes('out_of_stock')) ? 'out_of_stock' : 'available';

              const textToSearch = `${offer.name || ''} ${item.name || ''} ${offer.description || ''}`;
              const seeds = parseSeedsCount(textToSearch);

              offers.push({
                seeds,
                price,
                availability
              });
            }
          }
        }
      } catch { }
    }

    return { isNotFound: false, offers };
  } catch (err) {
    return null;
  }
}

// Scrape prices for a single URL
async function scrapeUrlPrices(shopName, url, scraperInst = null) {
  // Check if shop is registered as Shopify shop or URL path looks like Shopify
  const registryEntry = getScraperByName(shopName) || getScraperByDomain(url);
  const isShopify = registryEntry?.shopifyJson || url.includes('/products/');

  if (isShopify) {
    const shopifyResult = await fetchShopifyProductJson(url);
    if (shopifyResult && (shopifyResult.variants?.length > 0 || shopifyResult.isNotFound)) {
      return shopifyResult;
    }
  }

  // Try custom parser method on shop's scraper instance if available
  if (scraperInst && typeof scraperInst.parseOffersFromHtml === 'function') {
    try {
      const headers = typeof scraperInst.getHeaders === 'function' ? scraperInst.getHeaders() : {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'de-DE,de;q=0.9'
      };
      const res = await fetch(encodeURI(url), { headers });
      if (res.status === 404 || res.status === 410) {
        return { isNotFound: true, offers: [] };
      }
      if (res.ok) {
        const html = await res.text();
        const offers = scraperInst.parseOffersFromHtml(html);
        if (offers && offers.length > 0) {
          return { isNotFound: false, offers };
        }
      }
    } catch (err) { }
  }

  // Fallback / standard HTML JSON-LD parsing
  const htmlResult = await fetchHtmlJsonLd(url);
  if (htmlResult) {
    return htmlResult;
  }

  return { isNotFound: false, variants: [], offers: [] };
}

// Main execution
async function main() {
  initLogFiles();
  const options = parseArgs();
  initializeDatabase(sqlite);

  // Validate / fuzzy-match target shop filter
  if (options.targetShop) {
    let matchedEntry = getScraperByName(options.targetShop);

    if (!matchedEntry) {
      const cleanTarget = options.targetShop.toLowerCase().replace(/[^a-z0-9]/g, '');
      const fuzzyMatch = SCRAPER_REGISTRY.find(entry => {
        const cleanName = entry.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanName.includes(cleanTarget) || cleanTarget.includes(cleanName);
      });
      if (fuzzyMatch) {
        logMessage('info', `Target Shop Filter "${options.targetShop}" matched registered shop "${fuzzyMatch.name}"`);
        options.targetShop = fuzzyMatch.name;
        matchedEntry = fuzzyMatch;
      }
    }

    if (!matchedEntry) {
      logMessage('warning', `Shop name "${options.targetShop}" is not recognized.`);
      logMessage('info', `Available registered shop names:\n  - ${getAllShopNames().join('\n  - ')}`);
    }
  }

  logMessage('info', '==================================================');
  logMessage('info', 'Starting Direct URL Price Scraper CLI...');
  if (options.targetShop) logMessage('info', `Target Shop Filter: "${options.targetShop}"`);
  if (options.targetUrl) logMessage('info', `Target Single URL: "${options.targetUrl}"`);
  if (options.maxAgeHours) logMessage('info', `Filter Max Age Hours: ${options.maxAgeHours}h`);
  if (options.limit) logMessage('info', `Limit URLs: ${options.limit}`);
  if (options.dryRun) logMessage('info', `DRY RUN MODE ENABLED (No DB updates)`);
  logMessage('info', '==================================================');

  // Query unique offers from scraped_offers
  let query = `
    SELECT 
      scraped_offers.id,
      scraped_offers.strain_id AS strainId,
      scraped_offers.shop,
      scraped_offers.url,
      scraped_offers.seeds,
      scraped_offers.price,
      scraped_offers.availability,
      scraped_offers.fetched_at AS fetchedAt,
      strains.name AS strainName,
      strains.breeder AS strainBreeder
    FROM scraped_offers
    JOIN strains ON strains.id = scraped_offers.strain_id
    WHERE 1=1
  `;
  const params = [];

  if (options.targetShop) {
    query += ` AND LOWER(scraped_offers.shop) = LOWER(?)`;
    params.push(options.targetShop);
  }

  if (options.targetUrl) {
    query += ` AND scraped_offers.url = ?`;
    params.push(options.targetUrl);
  }

  if (options.maxAgeHours) {
    const cutoffIso = new Date(Date.now() - options.maxAgeHours * 60 * 60 * 1000).toISOString();
    query += ` AND scraped_offers.fetched_at < ?`;
    params.push(cutoffIso);
  }

  query += ` ORDER BY scraped_offers.fetched_at ASC`;

  const rows = sqlite.prepare(query).all(...params);

  if (rows.length === 0) {
    logMessage('info', 'No matching offers found in database for URL price refresh.');
    printSummaryReport(options);
    process.exit(0);
  }

  // Group existing offers by shop and url
  const urlGroups = new Map();
  for (const row of rows) {
    const key = `${row.shop}||${row.url}`;
    if (!urlGroups.has(key)) {
      urlGroups.set(key, {
        shop: row.shop,
        url: row.url,
        offers: []
      });
    }
    urlGroups.get(key).offers.push(row);
  }

  let totalGroups = Array.from(urlGroups.values());
  if (options.limit && options.limit > 0) {
    totalGroups = totalGroups.slice(0, options.limit);
  }

  logMessage('info', `Found ${rows.length} offer records across ${totalGroups.length} unique product URLs to refresh.`);

  // Create scraper instances cache for BaseScraper.upsertOffer
  const scraperInstances = new Map();
  function getScraperInstance(shopName) {
    if (!scraperInstances.has(shopName)) {
      const entry = getScraperByName(shopName);
      const ScraperClass = entry?.ScraperClass || BaseScraper;
      const inst = new ScraperClass(logMessage, 'price');
      scraperInstances.set(shopName, inst);
    }
    return scraperInstances.get(shopName);
  }

  // Process URLs
  for (let i = 0; i < totalGroups.length; i++) {
    const group = totalGroups[i];
    metrics.urlsProcessed++;

    logMessage('info', `[${i + 1}/${totalGroups.length}] Refreshing URL (${group.shop}): ${group.url}`);

    const scraperInst = getScraperInstance(group.shop);
    const result = await scrapeUrlPrices(group.shop, group.url, scraperInst);

    if (result.isNotFound) {
      metrics.urlsNotFound++;
      logMessage('warning', `URL returned 404/410 Not Found for ${group.shop}: ${group.url}`);

      if (!options.dryRun) {
        // Mark all existing offers for this URL as out_of_stock
        for (const offer of group.offers) {
          sqlite.prepare(`UPDATE scraped_offers SET availability = 'out_of_stock', fetched_at = ? WHERE id = ?`)
            .run(new Date().toISOString(), offer.id);
          metrics.offersOutOfStock++;
        }
      }
      continue;
    }

    const scrapedItems = result.variants || result.offers || [];

    if (scrapedItems.length === 0) {
      logMessage('warning', `No price data extracted for ${group.url}`);
      metrics.urlsFailed++;
      continue;
    }

    // Map scraped items back to existing offer records for this URL
    for (const existingOffer of group.offers) {
      // Find matching scraped item by seeds count
      let matchedItem = scrapedItems.find(item => item.seeds && item.seeds === existingOffer.seeds);

      // Fallback: If page has only 1 variant / price offer, match it to the existing offer for this URL
      if (!matchedItem && scrapedItems.length === 1) {
        matchedItem = scrapedItems[0];
      }

      if (matchedItem) {
        const newPrice = matchedItem.price;
        const newAvail = matchedItem.availability || 'available';
        const priceChanged = Math.abs(existingOffer.price - newPrice) > 0.01;

        if (priceChanged) {
          logMessage('price', `[PRICE UPDATED] Shop: ${group.shop} | Strain: ${existingOffer.strainName} (${existingOffer.strainId}) | Seeds: ${existingOffer.seeds} | Old Price: ${existingOffer.price} EUR -> New Price: ${newPrice} EUR | URL: ${group.url}`);
        } else {
          logMessage('info', `[PRICE UNCHANGED] Shop: ${group.shop} | Strain: ${existingOffer.strainName} | Seeds: ${existingOffer.seeds} | Price: ${newPrice} EUR | URL: ${group.url}`);
        }

        if (!options.dryRun) {
          await scraperInst.insertOffer({
            strainId: existingOffer.strainId,
            url: group.url,
            seeds: existingOffer.seeds,
            price: newPrice,
            availability: newAvail
          });
        }
      } else {
        logMessage('warning', `No direct variant match for seeds=${existingOffer.seeds} at ${group.url}`);
      }
    }

    // Also insert any newly discovered seed variants on the web page that don't exist in DB yet
    const mainStrainId = group.offers[0]?.strainId;
    if (mainStrainId) {
      const existingSeedCounts = new Set(group.offers.map(o => o.seeds));
      for (const item of scrapedItems) {
        if (item.seeds && item.price && !existingSeedCounts.has(item.seeds)) {
          logMessage('price', `[NEW VARIANT ADDED] Shop: ${group.shop} | StrainID: ${mainStrainId} | Seeds: ${item.seeds} | Price: ${item.price} EUR | URL: ${group.url}`);
          if (!options.dryRun) {
            const prevMode = scraperInst.scrapeMode;
            scraperInst.scrapeMode = 'full';
            await scraperInst.insertOffer({
              strainId: mainStrainId,
              url: group.url,
              seeds: item.seeds,
              price: item.price,
              availability: item.availability || 'available'
            });
            scraperInst.scrapeMode = prevMode;
            metrics.pricesUpdated++;
          }
        }
      }
    }
  }

  printSummaryReport(options);
}

// Print Execution Summary Report
function printSummaryReport(options) {
  metrics.endTime = Date.now();
  const durationMs = metrics.endTime - metrics.startTime;
  const durationSec = Math.round(durationMs / 1000);

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
    '                   DIRECT URL PRICE SCRAPER EXECUTION SUMMARY REPORT            ',
    '================================================================================',
    ` Started At        : ${new Date(metrics.startTime).toISOString()}`,
    ` Finished At       : ${new Date(metrics.endTime).toISOString()}`,
    ` Total Duration    : ${durationSec}s`,
    ` Target Shop Filter: ${options.targetShop || 'ALL Registered Shops'}`,
    ` Target Single URL : ${options.targetUrl || 'NONE'}`,
    ` Dry Run Mode      : ${options.dryRun ? 'YES' : 'NO'}`,
    '',
    ' --- WORKFLOW & METRICS ---',
    ` URLs Processed    : ${metrics.urlsProcessed}`,
    ` URLs Not Found    : ${metrics.urlsNotFound}`,
    ` URLs Failed/Empty : ${metrics.urlsFailed}`,
    ` Prices Updated    : ${metrics.pricesUpdated}`,
    ` Offers Out Of Stock: ${metrics.offersOutOfStock}`,
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
    ` Error Log         : ${errorsLogPath}`,
    '================================================================================'
  ];

  console.log(lines.join('\n'));
}

main().catch(err => {
  logMessage('error', `Fatal unhandled error in Direct URL Scraper: ${err.stack || err.message}`);
  process.exit(1);
});
