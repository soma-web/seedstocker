import { HouseOfSeedsScraper } from './HouseOfSeedsScraper.js';
import { ZamnesiaScraper } from './ZamnesiaScraper.js';
import { HansBrainfoodScraper } from './HansBrainfoodScraper.js';
import { GasStationCoScraper } from './GasStationCoScraper.js';
import { GasStationLuScraper } from './GasStationLuScraper.js';
import { SensiSeedsScraper } from './SensiSeedsScraper.js';
import { DutchPassionScraper } from './DutchPassionScraper.js';
import { BarneysFarmScraper } from './BarneysFarmScraper.js';

/**
 * Central scraper registry. Every new shop scraper is added here once,
 * and all orchestration code (triggerScrape, sanity-check, single-scrape,
 * db stats) loops over this list automatically.
 */
export const SCRAPER_REGISTRY = [
  {
    name: 'House of Seeds',
    ScraperClass: HouseOfSeedsScraper,
    domain: 'house-of-seeds.de',
    shopifyJson: true,
    defaultUrl: 'https://house-of-seeds.de/products.json'
  },
  {
    name: 'Zamnesia',
    ScraperClass: ZamnesiaScraper,
    domain: 'zamnesia.de',
    shopifyJson: false,
    defaultUrl: null
  },
  {
    name: 'Hans Brainfood',
    ScraperClass: HansBrainfoodScraper,
    domain: 'hansbrainfood.de',
    shopifyJson: true,
    defaultUrl: 'https://hansbrainfood.de/products.json'
  },
  {
    name: 'Gas Station Co. Seeds',
    ScraperClass: GasStationCoScraper,
    domain: 'gasstationcoseeds.de',
    shopifyJson: true,
    defaultUrl: 'https://gasstationcoseeds.de/products.json'
  },
  {
    name: 'Gas Station LU',
    ScraperClass: GasStationLuScraper,
    domain: 'gas-station.lu',
    shopifyJson: false,
    defaultUrl: null
  },
  {
    name: 'Sensi Seeds',
    ScraperClass: SensiSeedsScraper,
    domain: 'sensiseeds.com',
    shopifyJson: false,
    defaultUrl: 'https://sensiseeds.com/de/hanfsamen'
  },
  {
    name: 'Dutch Passion',
    ScraperClass: DutchPassionScraper,
    domain: 'dutch-passion.com',
    shopifyJson: false,
    defaultUrl: 'https://dutch-passion.com/de/hanfsamen'
  },
  {
    name: "Barney's Farm",
    ScraperClass: BarneysFarmScraper,
    domain: 'barneysfarm.de',
    shopifyJson: false,
    defaultUrl: 'https://www.barneysfarm.de/sitemap.xml'
  }
];

/**
 * Find a scraper entry by matching the URL domain.
 * @param {string} url - Product or shop URL
 * @returns {object|null} Registry entry or null
 */
export function getScraperByDomain(url) {
  if (!url) return null;
  const lower = url.toLowerCase();
  return SCRAPER_REGISTRY.find(entry => lower.includes(entry.domain)) || null;
}

/**
 * Find a scraper entry by shop name (case-insensitive).
 * @param {string} name - Shop name
 * @returns {object|null} Registry entry or null
 */
export function getScraperByName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  return SCRAPER_REGISTRY.find(entry => entry.name.toLowerCase() === lower) || null;
}

/**
 * Get all shop names from the registry.
 */
export function getAllShopNames() {
  return SCRAPER_REGISTRY.map(entry => entry.name);
}
