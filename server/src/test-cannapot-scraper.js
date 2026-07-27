import assert from 'node:assert';
import { CannapotScraper } from './scrapers/CannapotScraper.js';

class TestableCannapotScraper extends CannapotScraper {
  constructor() {
    super(null, 'price');
  }
}

function runCannapotScraperTests() {
  console.log('Running Cannapot Scraper Seed Type Tests...');
  const scraper = new TestableCannapotScraper();

  assert.strictEqual(scraper.extractSeedType('6 fem'), 'feminized');
  assert.strictEqual(scraper.extractSeedType('6 feminisierte Samen'), 'feminized');
  assert.strictEqual(scraper.extractSeedType('reguläre Samen'), 'regular');
  assert.strictEqual(scraper.extractSeedType('regular seeds'), 'regular');
  assert.strictEqual(scraper.extractSeedType('Strawberry Sour Diesel - Devils Harvest 6 fem Devils Harvest Seeds: Sorten, die super zu growen sind'), 'feminized');
  assert.strictEqual(scraper.extractSeedType('Devils Harvest Seeds: Sorten, die super zu growen sind'), null);

  console.log('All Cannapot scraper seed type tests PASSED successfully!');
}

runCannapotScraperTests();
