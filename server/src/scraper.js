import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HouseOfSeedsScraper } from './scrapers/HouseOfSeedsScraper.js';
import { ZamnesiaScraper } from './scrapers/ZamnesiaScraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFilePath = path.resolve(__dirname, '../data/scraper.log');
const configPath = path.resolve(__dirname, '../config/scraper.json');

function readConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch {}
  return { maxItemsPerShop: null, debug: false, shops: ['Zamnesia', 'House of Seeds'] };
}

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

// Background scraper runner
export async function triggerScrape() {
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
  logMessage('info', 'Starting complete background scraping task...');
  logMessage('info', '===============================================');
  
  try {
    const config = readConfig();
    const shopsToScrape = config.shops || [
      { name: 'Zamnesia', url: null },
      { name: 'House of Seeds', url: null }
    ];

    const getShopConfig = (name) => {
      return shopsToScrape.find(s => {
        if (typeof s === 'string') {
          return s.toLowerCase() === name.toLowerCase();
        }
        return s && s.name && s.name.toLowerCase() === name.toLowerCase();
      });
    };

    const hosConfig = getShopConfig('House of Seeds');
    if (hosConfig) {
      const targetUrl = typeof hosConfig === 'string' ? null : hosConfig.url;
      const hosScraper = new HouseOfSeedsScraper(logMessage);
      await hosScraper.scrape(scraperStatus, targetUrl);
    } else {
      logMessage('info', 'Skipping House of Seeds (not enabled in config).');
    }

    const zamnConfig = getShopConfig('Zamnesia');
    if (zamnConfig) {
      const targetUrl = typeof zamnConfig === 'string' ? null : zamnConfig.url;
      const zamnScraper = new ZamnesiaScraper(logMessage);
      await zamnScraper.scrape(scraperStatus, targetUrl);
    } else {
      logMessage('info', 'Skipping Zamnesia (not enabled in config).');
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
