import { sqlite } from '../server/src/db.js';

const rows = sqlite.prepare(`
  SELECT scraped_offers.id, scraped_offers.shop, scraped_offers.url, scraped_offers.strain_id, scraped_offers.seeds, scraped_offers.price, scraped_offers.availability, strains.name
  FROM scraped_offers
  JOIN strains ON strains.id = scraped_offers.strain_id
  WHERE scraped_offers.url LIKE '%zangria-s1-wizard-trees%'
`).all();

console.log(rows);
