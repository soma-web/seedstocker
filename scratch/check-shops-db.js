import { sqlite } from '../server/src/db.js';

const shops = sqlite.prepare(`
  SELECT DISTINCT shop
  FROM scraped_offers
  ORDER BY shop ASC
`).all().map(r => r.shop);

console.log('Shops in database:', shops);
