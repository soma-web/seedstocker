import { LindaSeedsScraper } from '../server/src/scrapers/LindaSeedsScraper.js';

async function test() {
  const scraper = new LindaSeedsScraper((level, msg) => console.log(`[${level}] ${msg}`), 'full');
  const targetUrl = 'https://www.linda-seeds.com/de/feminisierte-hanfsamen-kaufen/sativa/extrem-hoher-thc-gehalt/hoher-ertrag/gg4-sherbet-fast-flowering-fast-buds-company';
  
  await scraper.scrape({ currentShop: '' }, targetUrl);
}

test();
