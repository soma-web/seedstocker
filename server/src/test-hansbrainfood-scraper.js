import assert from 'node:assert';
import { HansBrainfoodScraper } from './scrapers/HansBrainfoodScraper.js';

class TestableHansBrainfoodScraper extends HansBrainfoodScraper {
  constructor() {
    super(null, 'price');
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

runHansBrainfoodScraperTests();
