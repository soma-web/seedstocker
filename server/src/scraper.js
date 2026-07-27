import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCRAPER_REGISTRY, getScraperByName } from './scrapers/registry.js';
import { getConfig } from './config.js';
import { db } from './db.js';
import { scrapedOffers } from './schema.js';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFilePath = path.resolve(__dirname, '../data/scraper.log');

export const scraperStatus = {
  isScanning: false,
  startTime: null,
  endTime: null,
  currentShop: null,
  currentProduct: null,
  productsScraped: 0,
  logs: []
};

// Global log helper
export function logMessage(type, message) {
  const time = new Date().toISOString();
  const logLine = `[${time}][Scraper][${type.toUpperCase()}] ${message}`;
  console.log(logLine);

  // In-memory logs
  scraperStatus.logs.push({ type, message, timestamp: time });
  if (scraperStatus.logs.length > 200) {
    scraperStatus.logs.shift(); // Keep last 200 logs in memory
  }

  // File logs
  try {
    fs.appendFileSync(logFilePath, logLine + '\n', 'utf8');
  } catch {}
}

// Background scraper runner — uses registry instead of copy-paste blocks
export async function triggerScrape(targetShopName = null, scrapeMode = 'price') {
  if (scraperStatus.isScanning) {
    logMessage('warning', 'Scraper already running. Call ignored.');
    return;
  }

  scraperStatus.isScanning = true;
  scraperStatus.startTime = new Date().toISOString();
  scraperStatus.endTime = null;
  scraperStatus.productsScraped = 0;

  // Reset logs file
  try {
    fs.writeFileSync(logFilePath, '', 'utf8');
  } catch {}

  logMessage('info', '===============================================');
  logMessage('info', targetShopName ? `Starting background scraping task for: ${targetShopName} (mode: ${scrapeMode})...` : `Starting complete background scraping task (mode: ${scrapeMode})...`);
  logMessage('info', '===============================================');

  try {
    const config = getConfig();
    const configuredShops = config.shops;

    const getShopConfig = (name) => {
      if (!configuredShops) return null;
      return configuredShops.find(s => {
        if (typeof s === 'string') {
          return s.toLowerCase() === name.toLowerCase();
        }
        return s && s.name && s.name.toLowerCase() === name.toLowerCase();
      });
    };

    const shouldScrape = (name) => {
      return !targetShopName || targetShopName.toLowerCase() === name.toLowerCase();
    };

    // Loop over all registered scrapers
    for (const entry of SCRAPER_REGISTRY) {
      const shopConfig = getShopConfig(entry.name);
      // Enabled if no explicit shop config array exists, OR if in config, OR if specifically targeted by user
      const isEnabled = !configuredShops || shopConfig !== undefined || (targetShopName && targetShopName.toLowerCase() === entry.name.toLowerCase());

      if (isEnabled && shouldScrape(entry.name)) {
        const scraper = new entry.ScraperClass(logMessage, scrapeMode);
        if (scrapeMode === 'price_quick') {
          logMessage('info', `Running quick price scrape for ${entry.name} from stored URLs...`);
          // Query stored URLs for this shop
          const stored = await db.select({ url: scrapedOffers.url })
            .from(scrapedOffers)
            .where(eq(scrapedOffers.shop, entry.name));
          const uniqueUrls = [...new Set(stored.map(o => o.url))];
          logMessage('info', `Found ${uniqueUrls.length} stored URLs to scrape for ${entry.name}`);
          
          let count = 0;
          for (const url of uniqueUrls) {
            try {
              await scraper.scrapeSingle(url);
              count++;
              scraperStatus.productsScraped = count; // Update count
            } catch (err) {
              logMessage('error', `Failed to scrape stored URL ${url}: ${err.message}`);
            }
            await scraper.sleep(300);
          }
          logMessage('success', `Quick price scrape completed for ${entry.name}. Scraped ${count}/${uniqueUrls.length} pages.`);
        } else {
          const targetUrl = (shopConfig && typeof shopConfig !== 'string' && shopConfig.url) ? shopConfig.url : (entry.defaultUrl || null);
          await scraper.scrape(scraperStatus, targetUrl);
        }
      } else if (isEnabled) {
        logMessage('info', `Skipping ${entry.name} (not requested for this run).`);
      } else {
        logMessage('info', `Skipping ${entry.name} (not enabled in config).`);
      }
    }

    logMessage('success', 'Scraper execution finished successfully!');
  } catch (err) {
    logMessage('error', `Scraper task failed with error: ${err.message}`);
  } finally {
    scraperStatus.isScanning = false;
    scraperStatus.endTime = new Date().toISOString();
    scraperStatus.currentShop = null;
    scraperStatus.currentProduct = null;
    logMessage('info', 'Background task terminated.');
  }
}
