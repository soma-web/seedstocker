import assert from 'node:assert';
import { HouseOfSeedsScraper } from './scrapers/HouseOfSeedsScraper.js';

class TestableHouseOfSeedsScraper extends HouseOfSeedsScraper {
  constructor() {
    super(null, 'price');
  }
}

async function runHouseOfSeedsScraperTests() {
  console.log('Running House of Seeds Scraper Unit Tests...');
  const scraper = new TestableHouseOfSeedsScraper();

  // --- 1. Custom Metafields Parsing (Icons Row) ---
  const sampleHtml = `
    <html>
      <body>
        <h3 class="icons-row-item__title">Genetics / Typ</h3>
        <div class="icons-row-item__text">
          <p>Indica Dominant (70% Indica / 30% Sativa)</p>
        </div>
      </body>
    </html>
  `;
  const specs = scraper.parseMetafieldsFromHtml(sampleHtml);
  assert.strictEqual(specs.strainType, 'Indica Dominant (70% Indica / 30% Sativa)');

  // --- 2. Normalization / Cleaning ---
  assert.strictEqual(scraper.normalizeBreeder('RQS'), 'Royal Queen Seeds');
  assert.strictEqual(scraper.normalizeStrainName('Royal Queen Runtz', 'Royal Queen Seeds'), 'Runtz');

  // --- 3. Seed Count Extraction from SKU & Variant Title ---
  assert.strictEqual(scraper.parseSeedCount('Default Title', 'HH-US-FC-3'), 3, 'SKU HH-US-FC-3 should extract 3 seeds');
  assert.strictEqual(scraper.parseSeedCount('Default Title', 'SEN-NL5R-10'), 10, 'SKU SEN-NL5R-10 should extract 10 seeds');
  assert.strictEqual(scraper.parseSeedCount('Default Title', 'GRG-PZ-7'), 7, 'SKU GRG-PZ-7 should extract 7 seeds');
  assert.strictEqual(scraper.parseSeedCount('7', 'GRG-BCH-8'), 7, 'Title "7" should take priority over SKU suffix "-8"');
  assert.strictEqual(scraper.parseSeedCount('HH-US-FC-3'), 3, 'Direct SKU string HH-US-FC-3 should extract 3 seeds');
  assert.strictEqual(scraper.parseSeedCount('3 Seeds'), 3, 'Standard title 3 Seeds should extract 3 seeds');

  // --- 4. HTML Offer Parsing ---
  const mockHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <script>
          var meta = {"product":{"id":16103108968783,"vendor":"Holy Hemp","type":"Cannabissamen","handle":"funnel-cake-holy-hemp","variants":[{"id":57702681444687,"price":1592,"name":"Funnel Cake","public_title":null,"sku":"HH-US-FC-3"}]}};
        </script>
      </head>
    </html>
  `;
  const offers = await scraper.parseOffersFromHtml(mockHtml, 'https://house-of-seeds.de/products/funnel-cake-holy-hemp');
  assert.strictEqual(offers.length, 1);
  assert.strictEqual(offers[0].seeds, 3);
  assert.strictEqual(offers[0].price, 15.92);

  console.log('All House of Seeds Scraper unit tests PASSED successfully!');
}

runHouseOfSeedsScraperTests().catch(err => {
  console.error('House of Seeds Scraper Unit Tests FAILED:', err);
  process.exit(1);
});
