import assert from 'node:assert';
import { GasStationCoScraper } from './scrapers/GasStationCoScraper.js';

class TestableGasStationCoScraper extends GasStationCoScraper {
  constructor() {
    super(null, 'price');
  }
}

function runGasStationCoScraperTests() {
  console.log('Running Gas Station Co. Seeds Scraper Unit Tests...');
  const scraper = new TestableGasStationCoScraper();

  // --- 1. extractBreeder Tests ---
  const product1 = {
    title: 'Dr. Doom S1 - Copycat Genetix',
    body_html: '<span>Marke: Copycat Genetix</span>'
  };
  assert.strictEqual(scraper.extractBreeder(product1), 'Copycat Genetix');

  const product2 = {
    title: 'Black Maraschino by Robin Hood Seeds',
    body_html: 'Breeder: Robin Hood Seeds'
  };
  assert.strictEqual(scraper.extractBreeder(product2), 'Robin Hood Seeds');

  const product3 = {
    title: 'CAP Junky (Alien Cookies F2 x Kush Mints 11) Capulator',
    body_html: ''
  };
  assert.strictEqual(scraper.extractBreeder(product3), 'Capulator');

  // --- 2. normalizeStrainName Tests ---
  assert.strictEqual(scraper.normalizeStrainName('7+1 Amnesia Haze', 'Sensi Seeds'), 'Amnesia Haze');
  assert.strictEqual(scraper.normalizeStrainName('**LIMITED** Runtz - Cookies', 'Cookies Seedbank'), 'Runtz');
  assert.strictEqual(scraper.normalizeStrainName('Gelato 41 - Sherbinskis', 'Sherbinskis'), 'Gelato 41');

  // --- 3. parseMetafieldsFromHtml (Flowering Time Day-to-Week Conversion & Lineage) ---
  const sampleHtml = `
    <html>
      <body>
        <p>Flowering Time: 56-63 days</p>
        <p>Lineage: Gelato 41 x Runtz</p>
      </body>
    </html>
  `;
  const specs = scraper.parseMetafieldsFromHtml(sampleHtml);
  assert.strictEqual(specs.floweringTime, '8-9');
  assert.strictEqual(specs.genetics, 'Gelato 41 x Runtz');

  console.log('All Gas Station Co. Seeds Scraper unit tests PASSED successfully!');
}

runGasStationCoScraperTests();
