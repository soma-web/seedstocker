import assert from 'node:assert';
import { CannapotScraper } from './scrapers/CannapotScraper.js';

class TestableCannapotScraper extends CannapotScraper {
  constructor() {
    super(null, 'price');
  }
}

function runCannapotScraperTests() {
  console.log('Running Cannapot Scraper Tests...');
  const scraper = new TestableCannapotScraper();

  // Seed Type Tests
  assert.strictEqual(scraper.extractSeedType('6 fem'), 'feminized');
  assert.strictEqual(scraper.extractSeedType('6 feminisierte Samen'), 'feminized');
  assert.strictEqual(scraper.extractSeedType('reguläre Samen'), 'regular');
  assert.strictEqual(scraper.extractSeedType('regular seeds'), 'regular');
  assert.strictEqual(scraper.extractSeedType('Strawberry Sour Diesel - Devils Harvest 6 fem Devils Harvest Seeds: Sorten, die super zu growen sind'), 'feminized');
  assert.strictEqual(scraper.extractSeedType('Devils Harvest Seeds: Sorten, die super zu growen sind'), null);

  // Genetics Extraction Tests
  assert.strictEqual(scraper.extractGenetics('Zusammensetzung: 70% Sativa / 30% Indica'), '70% Sativa / 30% Indica');
  assert.strictEqual(scraper.extractGenetics('Zusammensetzung: 100% Indica'), '100% Indica');
  assert.strictEqual(scraper.extractGenetics('Zusammensetzung: Sativa/Indica'), 'Sativa/Indica');
  assert.strictEqual(scraper.extractGenetics('Genetik: Skunk x Northern Lights'), 'Skunk x Northern Lights');

  // Strain Type Determination Tests
  assert.strictEqual(scraper.determineStrainTypeFromText('70% Sativa / 30% Indica'), 'hybrid');
  assert.strictEqual(scraper.determineStrainTypeFromText('Sativa / Indica'), 'hybrid');
  assert.strictEqual(scraper.determineStrainTypeFromText('100% Indica'), 'indica');
  assert.strictEqual(scraper.determineStrainTypeFromText('100% Sativa'), 'sativa');
  assert.strictEqual(scraper.determineStrainTypeFromText('Indica-dominant'), 'indica-dominant');

  // Plant Type (Autoflower) Tests
  assert.strictEqual(scraper.determinePlantType('Super Skunk Automatic', ''), 'autoflower');
  assert.strictEqual(scraper.determinePlantType('Northern Lights Auto', ''), 'autoflower');
  assert.strictEqual(scraper.determinePlantType('White Widow', 'Zusammensetzung: Automatic / Sativa / Indica'), 'autoflower');
  // Flowering Time Tests
  assert.strictEqual(scraper.extractFloweringTime('Blütezeit: 8-9 Wochen'), '8-9');
  assert.strictEqual(scraper.extractFloweringTime('Blütendauer: 56 - 63 Tage'), '8-9');
  assert.strictEqual(scraper.extractFloweringTime('Blütezeit: 9 Wochen'), '9');

  // THC Extraction Tests
  assert.strictEqual(scraper.extractThc('THC: 22%'), '22%');
  assert.strictEqual(scraper.extractThc('THC-Gehalt: 20-24%'), '22%');
  assert.strictEqual(scraper.extractThc('THC: Sehr hoch'), '21%');

  // Strain Name Normalization Tests (strip trailing [] or [ ])
  assert.strictEqual(scraper.normalizeStrainName('Super Skunk []', 'Sensi Seeds'), 'Super Skunk');
  assert.strictEqual(scraper.normalizeStrainName('Super Skunk [ ]', 'Sensi Seeds'), 'Super Skunk');
  assert.strictEqual(scraper.normalizeStrainName('Super Skunk [fem]', 'Sensi Seeds'), 'Super Skunk');
  assert.strictEqual(scraper.normalizeStrainName('Super Skunk [reg] [ ]', 'Sensi Seeds'), 'Super Skunk');

  console.log('All Cannapot scraper tests PASSED successfully!');
}

runCannapotScraperTests();

