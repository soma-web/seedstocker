import assert from 'node:assert';
import { BaseScraper } from './scrapers/BaseScraper.js';

class MockScraper extends BaseScraper {
  constructor() {
    super('Mock Shop', 'https://mock.com');
  }
  // Dummy scrape method to fulfill base requirements
  async scrape() {}
  async scrapeSingle() {}
}

function runNormalizationTests() {
  console.log('Running THC/CBD Normalization Unit Tests...');
  const scraper = new MockScraper();

  // --- THC Tests ---
  // Gering / Low / Mild -> 2%
  assert.strictEqual(scraper.cleanThc('Gering'), '2%');
  assert.strictEqual(scraper.cleanThc('Low'), '2%');
  assert.strictEqual(scraper.cleanThc('mild'), '2%');

  // Mittel / Medium / Moderate -> 10%
  assert.strictEqual(scraper.cleanThc('Mittel'), '10%');
  assert.strictEqual(scraper.cleanThc('Medium'), '10%');
  assert.strictEqual(scraper.cleanThc('moderate'), '10%');

  // Hoch / High / Strong -> 21%
  assert.strictEqual(scraper.cleanThc('Hoch'), '21%');
  assert.strictEqual(scraper.cleanThc('High'), '21%');
  assert.strictEqual(scraper.cleanThc('strong'), '21%');

  // Standard percentages should pass through or be cleaned
  assert.strictEqual(scraper.cleanThc('22%'), '22%');
  assert.strictEqual(scraper.cleanThc('ca. 18 %'), '18%');
  assert.strictEqual(scraper.cleanThc('16 - 18%'), '17%');
  assert.strictEqual(scraper.cleanThc('15'), '15%');

  // --- CBD Tests ---
  // Gering / Low / Mild -> 1%
  assert.strictEqual(scraper.cleanCbd('Gering'), '1%');
  assert.strictEqual(scraper.cleanCbd('Low'), '1%');
  assert.strictEqual(scraper.cleanCbd('mild'), '1%');

  // Mittel / Medium / Moderate -> 7%
  assert.strictEqual(scraper.cleanCbd('Mittel'), '7%');
  assert.strictEqual(scraper.cleanCbd('medium'), '7%');
  assert.strictEqual(scraper.cleanCbd('moderate'), '7%');

  // Hoch / High / Strong -> 11%
  assert.strictEqual(scraper.cleanCbd('Hoch'), '11%');
  assert.strictEqual(scraper.cleanCbd('high'), '11%');
  assert.strictEqual(scraper.cleanCbd('strong'), '11%');

  // Standard percentages should pass through or be cleaned, and ranges should return max value
  assert.strictEqual(scraper.cleanCbd('5%'), '5%');
  assert.strictEqual(scraper.cleanCbd('ca. 2 %'), '2%');
  assert.strictEqual(scraper.cleanCbd('1-2%'), '2%');
  assert.strictEqual(scraper.cleanCbd('0-1%'), '1%');
  assert.strictEqual(scraper.cleanCbd('0.5% - 1.5%'), '1.5%');

  // --- Flowering Range Tests ---
  assert.deepStrictEqual(scraper.parseFloweringRange('8'), { min: 8, max: 8 });
  assert.deepStrictEqual(scraper.parseFloweringRange('7-8 wochen'), { min: 7, max: 8 });
  assert.deepStrictEqual(scraper.parseFloweringRange('8–9'), { min: 8, max: 9 });
  assert.deepStrictEqual(scraper.parseFloweringRange('Flowering 8–9 weeks'), { min: 8, max: 9 });
  assert.deepStrictEqual(scraper.parseFloweringRange('8 - 10 weeks'), { min: 8, max: 10 });
  assert.deepStrictEqual(scraper.parseFloweringRange(null), { min: null, max: null });

  // --- HOS Days to Weeks Tests ---
  assert.strictEqual(scraper.cleanFloweringTime('Mittel (56–65 Tage)'), '8-9');
  assert.strictEqual(scraper.cleanFloweringTime('56 Tage'), '8');

  // --- THC Average Range Tests ---
  assert.strictEqual(scraper.cleanThc('15–25% THC'), '20%');
  assert.strictEqual(scraper.cleanThc('18-22%'), '20%');
  assert.strictEqual(scraper.cleanThc('12-16%'), '14%');

  console.log('All normalization unit tests PASSED successfully!');
}

runNormalizationTests();
