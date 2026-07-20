import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HouseOfSeedsScraper } from './scrapers/HouseOfSeedsScraper.js';
import { ZamnesiaScraper } from './scrapers/ZamnesiaScraper.js';
import { HansBrainfoodScraper } from './scrapers/HansBrainfoodScraper.js';
import { GasStationCoScraper } from './scrapers/GasStationCoScraper.js';
import { SensiSeedsScraper } from './scrapers/SensiSeedsScraper.js';

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
    const config = readConfig();
    const shopsToScrape = config.shops || [
      { name: 'Zamnesia', url: null },
      { name: 'House of Seeds', url: null },
      { name: 'Hans Brainfood', url: null },
      { name: 'Gas Station Co. Seeds', url: null },
      { name: 'Sensi Seeds', url: null }
    ];

    const getShopConfig = (name) => {
      return shopsToScrape.find(s => {
        if (typeof s === 'string') {
          return s.toLowerCase() === name.toLowerCase();
        }
        return s && s.name && s.name.toLowerCase() === name.toLowerCase();
      });
    };

    const shouldScrape = (name) => {
      return !targetShopName || targetShopName.toLowerCase() === name.toLowerCase();
    };

    const hosConfig = getShopConfig('House of Seeds');
    if (hosConfig && shouldScrape('House of Seeds')) {
      const targetUrl = typeof hosConfig === 'string' ? null : hosConfig.url;
      const hosScraper = new HouseOfSeedsScraper(logMessage, scrapeMode);
      await hosScraper.scrape(scraperStatus, targetUrl);
    } else if (hosConfig) {
      logMessage('info', 'Skipping House of Seeds (not requested for this run).');
    } else {
      logMessage('info', 'Skipping House of Seeds (not enabled in config).');
    }

    const zamnConfig = getShopConfig('Zamnesia');
    if (zamnConfig && shouldScrape('Zamnesia')) {
      const targetUrl = typeof zamnConfig === 'string' ? null : zamnConfig.url;
      const zamnScraper = new ZamnesiaScraper(logMessage, scrapeMode);
      await zamnScraper.scrape(scraperStatus, targetUrl);
    } else if (zamnConfig) {
      logMessage('info', 'Skipping Zamnesia (not requested for this run).');
    } else {
      logMessage('info', 'Skipping Zamnesia (not enabled in config).');
    }

    const hansConfig = getShopConfig('Hans Brainfood');
    if (hansConfig && shouldScrape('Hans Brainfood')) {
      const targetUrl = typeof hansConfig === 'string' ? null : hansConfig.url;
      const hansScraper = new HansBrainfoodScraper(logMessage, scrapeMode);
      await hansScraper.scrape(scraperStatus, targetUrl);
    } else if (hansConfig) {
      logMessage('info', 'Skipping Hans Brainfood (not requested for this run).');
    } else {
      logMessage('info', 'Skipping Hans Brainfood (not enabled in config).');
    }

    const gasConfig = getShopConfig('Gas Station Co. Seeds');
    if (gasConfig && shouldScrape('Gas Station Co. Seeds')) {
      const targetUrl = typeof gasConfig === 'string' ? null : gasConfig.url;
      const gasScraper = new GasStationCoScraper(logMessage, scrapeMode);
      await gasScraper.scrape(scraperStatus, targetUrl);
    } else if (gasConfig) {
      logMessage('info', 'Skipping Gas Station Co. Seeds (not requested for this run).');
    } else {
      logMessage('info', 'Skipping Gas Station Co. Seeds (not enabled in config).');
    }

    const sensiConfig = getShopConfig('Sensi Seeds');
    if (sensiConfig && shouldScrape('Sensi Seeds')) {
      const targetUrl = typeof sensiConfig === 'string' ? null : sensiConfig.url;
      const sensiScraper = new SensiSeedsScraper(logMessage, scrapeMode);
      await sensiScraper.scrape(scraperStatus, targetUrl);
    } else if (sensiConfig) {
      logMessage('info', 'Skipping Sensi Seeds (not requested for this run).');
    } else {
      logMessage('info', 'Skipping Sensi Seeds (not enabled in config).');
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
