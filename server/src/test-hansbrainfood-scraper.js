import assert from 'node:assert';
import { HansBrainfoodScraper } from './scrapers/HansBrainfoodScraper.js';

class TestableHansBrainfoodScraper extends HansBrainfoodScraper {
  constructor() {
    super(null, 'price');
    this.fetchedUrls = [];
    this.upsertedStrains = [];
    this.insertedOffers = [];
    this.mockHtml = '';
  }

  async fetchWithRetry(url, options) {
    this.fetchedUrls.push({ url, options });
    return {
      ok: true,
      status: 200,
      text: async () => this.mockHtml
    };
  }

  async upsertStrain(data) {
    this.upsertedStrains.push(data);
    return 'mock-strain-id';
  }

  async insertOffer(data) {
    this.insertedOffers.push(data);
  }
}

function runHansBrainfoodScraperTests() {
  console.log('Running Hans Brainfood Scraper Unit Tests...');
  const scraper = new TestableHansBrainfoodScraper();

  // --- 1. isInvalidStrainName ---
  assert.strictEqual(scraper.isInvalidStrainName('Bio Hanfsamen geschält'), true);
  assert.strictEqual(scraper.isInvalidStrainName('Bio Hanfsamen ungeschält 1kg'), true);
  assert.strictEqual(scraper.isInvalidStrainName('Vorratspackung geschält'), true);
  assert.strictEqual(scraper.isInvalidStrainName('Amnesia Haze Feminisiert'), false);

  // --- 2. normalizeStrainName ---
  // Premium US removal
  assert.strictEqual(scraper.normalizeStrainName('Premium US Gorilla Glue', 'Exotic Genetix'), 'Gorilla Glue');
  assert.strictEqual(scraper.normalizeStrainName('Amnesia Haze (Feminisiert)', 'Sensi Seeds'), 'Amnesia Haze');

  // 187 branding split logic: "187 Sweedz - Miami Vice Auto" -> "Miami Vice"
  assert.strictEqual(scraper.normalizeStrainName('187 Sweedz - Miami Vice Auto', '187 Sweedz'), 'Miami Vice');
  assert.strictEqual(scraper.normalizeStrainName('187 Sweedz - Zkittlez Feminisiert', '187 Sweedz'), 'Zkittlez');

  // --- 3. Breeder Normalization ---
  assert.strictEqual(scraper.normalizeBreeder('187 Strassenbande'), '187 Sweedz');
  assert.strictEqual(scraper.normalizeBreeder('187'), '187 Sweedz');

  console.log('All Hans Brainfood Scraper unit tests PASSED successfully!');
}

async function runScrapeSingleTests() {
  console.log('Running Hans Brainfood Scraper scrapeSingle tests...');

  // Case 1: Regular seeds product
  const scraper = new TestableHansBrainfoodScraper();
  scraper.mockHtml = `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "http://schema.org/",
            "@type": "Product",
            "name": "Hanfsamen Nepal Queen Regular von BudVoyage",
            "vendor": "BudVoyage",
            "offers": {
              "@type": "Offer",
              "price": "24.99",
              "availability": "http://schema.org/InStock"
            }
          }
        </script>
      </head>
    </html>
  `;

  const result = await scraper.scrapeSingle('https://hansbrainfood.de/products/hanfsamen-nepal-queen-regular-von-budvoyage');
  
  assert.ok(result, 'Result should not be null');
  assert.strictEqual(result.name, 'Nepal Queen');
  assert.strictEqual(result.breeder, 'Bud Voyage'); // Normalized from BudVoyage
  
  assert.strictEqual(scraper.upsertedStrains.length, 1);
  const upserted = scraper.upsertedStrains[0];
  assert.strictEqual(upserted.name, 'Nepal Queen');
  assert.strictEqual(upserted.breeder, 'Bud Voyage');
  assert.strictEqual(upserted.seedType, 'regular');

  assert.strictEqual(scraper.insertedOffers.length, 1);
  const offer = scraper.insertedOffers[0];
  assert.strictEqual(offer.strainId, 'mock-strain-id');
  assert.strictEqual(offer.price, 24.99);
  assert.strictEqual(offer.seeds, 1);
  assert.strictEqual(offer.availability, 'available');

  console.log('scrapeSingle regular seeds test passed!');

  // Case 2: Feminized seeds product with variants
  const scraper2 = new TestableHansBrainfoodScraper();
  scraper2.mockHtml = `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "http://schema.org/",
            "@type": "Product",
            "name": "Pink Ztrawberriez Auto Hanfsamen von BudVoyage",
            "vendor": "BudVoyage",
            "variants": [
              {
                "title": "3 Seeds",
                "price": "19.99",
                "available": true
              },
              {
                "title": "5 Seeds",
                "price": "29.99",
                "available": false
              }
            ]
          }
        </script>
      </head>
    </html>
  `;

  const result2 = await scraper2.scrapeSingle('https://hansbrainfood.de/products/pink-ztrawberriez-auto-hanfsamen-von-budvoyage');
  assert.ok(result2, 'Result should not be null');
  assert.strictEqual(result2.name, 'Pink Ztrawberriez');
  assert.strictEqual(result2.breeder, 'Bud Voyage');

  assert.strictEqual(scraper2.upsertedStrains.length, 1);
  const upserted2 = scraper2.upsertedStrains[0];
  assert.strictEqual(upserted2.seedType, 'feminized'); // default

  assert.strictEqual(scraper2.insertedOffers.length, 2);
  assert.strictEqual(scraper2.insertedOffers[0].seeds, 3);
  assert.strictEqual(scraper2.insertedOffers[0].price, 19.99);
  assert.strictEqual(scraper2.insertedOffers[0].availability, 'available');

  assert.strictEqual(scraper2.insertedOffers[1].seeds, 5);
  assert.strictEqual(scraper2.insertedOffers[1].price, 29.99);
  assert.strictEqual(scraper2.insertedOffers[1].availability, 'out_of_stock');

  console.log('scrapeSingle variants test passed!');
}

async function main() {
  runHansBrainfoodScraperTests();
  await runScrapeSingleTests();
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
