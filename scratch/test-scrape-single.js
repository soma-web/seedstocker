import { HouseOfSeedsScraper } from '../server/src/scrapers/HouseOfSeedsScraper.js';
import { sqlite } from '../server/src/db.js';

async function main() {
  const scraper = new HouseOfSeedsScraper(console.log, 'full');
  const result = await scraper.scrapeSingle('https://house-of-seeds.de/products/zangria-s1-wizard-trees');
  console.log('Result:', result);

  const rows = sqlite.prepare(`
    SELECT scraped_offers.id, scraped_offers.shop, scraped_offers.url, scraped_offers.seeds, scraped_offers.price, scraped_offers.availability
    FROM scraped_offers
    WHERE scraped_offers.strain_id = 'b7aa1045-7176-458f-88fa-9f5f25d21eb4'
  `).all();
  console.log('Database rows for Zangria S1:', rows);
}

main();
