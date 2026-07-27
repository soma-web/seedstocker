import assert from 'node:assert';
import { ZamnesiaScraper } from './scrapers/ZamnesiaScraper.js';

class TestableZamnesiaScraper extends ZamnesiaScraper {
  constructor() {
    super(null, 'price');
  }
}

function runZamnesiaScraperTests() {
  console.log('Running Zamnesia Scraper Unit Tests...');
  const scraper = new TestableZamnesiaScraper();

  // --- 1. parseArgs Tests ---
  const sampleArgs = "14927, new Array('1', '2'), 10, 'combo-key', 5, 0, 0, 0, 0, 0, 24.50";
  const parsedArgs = scraper.parseArgs(sampleArgs);
  assert.strictEqual(parsedArgs.length, 11);
  assert.strictEqual(parsedArgs[0], '14927');
  assert.strictEqual(parsedArgs[1], "new Array('1', '2')");
  assert.strictEqual(parsedArgs[10], '24.50');

  // --- 2. extractDescription Tests ---
  const sampleHtml = `
    <html>
      <head>
        <meta name="description" content="This is an awesome strain description from Zamnesia." />
      </head>
      <body>
        <script type="application/ld+json">
          {
            "@type": "Product",
            "name": "Gorilla Piss",
            "description": "JSON-LD description of Gorilla Piss"
          }
        </script>
      </body>
    </html>
  `;
  const desc = scraper.extractDescription(sampleHtml);
  assert.strictEqual(desc, 'JSON-LD description of Gorilla Piss');

  const metaHtml = `
    <html>
      <head>
        <meta name="description" content="Meta tag description text" />
      </head>
    </html>
  `;
  const metaDesc = scraper.extractDescription(metaHtml);
  assert.strictEqual(metaDesc, 'Meta tag description text');

  // --- 3. Breeder Normalization ---
  assert.strictEqual(scraper.normalizeBreeder('Zamnesia'), 'Zamnesia Seeds');
  assert.strictEqual(scraper.normalizeBreeder('Exotic Seeds'), 'Exotic Seeds');
  assert.strictEqual(scraper.normalizeBreeder(null), 'Unknown Breeder');

  // --- 4. Strain Name Normalization ---
  assert.strictEqual(scraper.normalizeStrainName('Gorilla Piss Fast Version', 'Zamnesia Seeds'), 'Gorilla Piss');
  assert.strictEqual(scraper.normalizeStrainName('Amnesia Haze Feminisiert', 'Zamnesia Seeds'), 'Amnesia Haze');

  console.log('All Zamnesia Scraper unit tests PASSED successfully!');
}

runZamnesiaScraperTests();
