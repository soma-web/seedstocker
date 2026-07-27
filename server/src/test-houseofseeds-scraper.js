import assert from 'node:assert';
import { HouseOfSeedsScraper } from './scrapers/HouseOfSeedsScraper.js';

class TestableHouseOfSeedsScraper extends HouseOfSeedsScraper {
  constructor() {
    super(null, 'price');
  }
}

function runHouseOfSeedsScraperTests() {
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

  console.log('All House of Seeds Scraper unit tests PASSED successfully!');
}

runHouseOfSeedsScraperTests();
