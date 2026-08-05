import assert from 'node:assert';
import { LindaSeedsScraper } from './scrapers/LindaSeedsScraper.js';

class TestableLindaSeedsScraper extends LindaSeedsScraper {
  constructor() {
    super(null, 'price');
  }
}

async function runLindaSeedsScraperTests() {
  console.log('Running Linda Seeds Scraper Unit Tests...');
  const scraper = new TestableLindaSeedsScraper();

  // ==========================================
  // 1. Breeder Normalization Tests
  // ==========================================
  console.log('  1. Testing Breeder Normalization...');
  assert.strictEqual(scraper.normalizeBreeder('Linda Seeds'), 'Linda Seeds');
  assert.strictEqual(scraper.normalizeBreeder('Humboldt Seed Company'), 'Humboldt Seed Company');
  assert.strictEqual(scraper.normalizeBreeder('Sweet Seeds'), 'Sweet Seeds');
  assert.strictEqual(scraper.normalizeBreeder(null), 'Unknown Breeder');

  // ==========================================
  // 2. Strain Name Normalization Tests
  // ==========================================
  console.log('  2. Testing Strain Name Normalization...');
  assert.strictEqual(
    scraper.normalizeStrainName('Hyper ZA Samen von Humboldt Seed Company', 'Humboldt Seed Company'),
    'Hyper ZA'
  );
  assert.strictEqual(
    scraper.normalizeStrainName('Gorilla Cookies Fast Flowering®', 'Fast Buds'),
    'Gorilla Cookies'
  );
  assert.strictEqual(
    scraper.normalizeStrainName('Amnesia Haze Feminisierte Hanfsamen', 'Linda Seeds'),
    'Amnesia Haze'
  );

  // ==========================================
  // 3. Flowering Duration Mapping Rules (Blütedauer: mittel = 8-10 Wochen)
  // ==========================================
  console.log('  3. Testing Flowering Duration Mapping...');
  assert.deepStrictEqual(
    scraper.parseFloweringTime('mittel'),
    { floweringTime: '8-10 Wochen', floweringMin: 8, floweringMax: 10 },
    'mittel should map to 8-10 Wochen'
  );
  assert.deepStrictEqual(
    scraper.parseFloweringTime('kurz'),
    { floweringTime: '6-8 Wochen', floweringMin: 6, floweringMax: 8 },
    'kurz should map to 6-8 Wochen'
  );
  assert.deepStrictEqual(
    scraper.parseFloweringTime('lang'),
    { floweringTime: '10-12 Wochen', floweringMin: 10, floweringMax: 12 },
    'lang should map to 10-12 Wochen'
  );
  assert.deepStrictEqual(
    scraper.parseFloweringTime('7-8 Wochen'),
    { floweringTime: '7-8 Wochen', floweringMin: 7, floweringMax: 8 },
    '7-8 Wochen should parse to min=7, max=8'
  );

  // ==========================================
  // 4. THC Content Mapping Rules (THC-Gehalt: sehr hoch = 25-30%)
  // ==========================================
  console.log('  4. Testing THC Content Mapping...');
  assert.strictEqual(scraper.parseThc('sehr hoch'), '25-30%', 'sehr hoch should map to 25-30%');
  assert.strictEqual(scraper.parseThc('extrem hoch'), '25-30%', 'extrem hoch should map to 25-30%');
  assert.strictEqual(scraper.parseThc('hoch'), '20-25%', 'hoch should map to 20-25%');
  assert.strictEqual(scraper.parseThc('THC: 35 %'), '35%', '35 % explicit should parse to 35%');

  // ==========================================
  // 5. Genotype (Indica / Sativa / Hybrid) Extraction
  // ==========================================
  console.log('  5. Testing Genotype Extraction...');
  assert.strictEqual(scraper.parseGenotype('mehr indica'), 'Mostly Indica');
  assert.strictEqual(scraper.parseGenotype('mehr sativa'), 'Mostly Sativa');
  assert.strictEqual(scraper.parseGenotype('hybrid'), 'Hybrid');
  assert.strictEqual(scraper.parseGenotype('indicadominierter Hybrid'), 'Mostly Indica');

  // ==========================================
  // 6. Seed & Plant Type Classification
  // ==========================================
  console.log('  6. Testing Seed & Plant Type Classification...');
  assert.deepStrictEqual(
    scraper.parseSeedAndPlantType('autoflowering, selbstblühend', '/de/autoflowering-hanfsamen-kaufen'),
    { plantType: 'autoflower', seedType: 'feminized' }
  );
  assert.deepStrictEqual(
    scraper.parseSeedAndPlantType('regulär, blüht automatisch', '/de/regulaere-hanfsamen-kaufen'),
    { plantType: 'autoflower', seedType: 'regular' }
  );
  assert.deepStrictEqual(
    scraper.parseSeedAndPlantType('feminisiert, blüht lichtabhängig', '/de/feminisierte-hanfsamen-kaufen'),
    { plantType: 'photoperiodic', seedType: 'feminized' }
  );

  // ==========================================
  // 7. Option & Price HTML Parsing (parseOffersFromHtml)
  // ==========================================
  console.log('  7. Testing parseOffersFromHtml...');
  const sampleHtml = `
    <form name="cart_insert_5740" action="..." method="get">
      <input type="hidden" name="products_id" value="5740" />
      <div id="id_5740_0" style="display:none;">&lt;div class=&quot;h2 special muy-1&quot;&gt;34.50 EUR&lt;/div&gt;</div>
      <div id="id_5740_1" style="display:none;">&lt;div class=&quot;h2 special muy-1&quot;&gt;51.90 EUR&lt;/div&gt;</div>
      <div id="id_5740_2" style="display:none;">&lt;div class=&quot;h2 special muy-1&quot;&gt;314.90 EUR&lt;/div&gt;</div>
      <select name="id7">
        <option value="17" selected> &nbsp; 3 feminisierte Samen</option>
        <option value="19"> &nbsp; 5 + 2 feminisierte Samen</option>
        <option value="99" disabled> &nbsp; 100 feminisierte Samen</option>
      </select>
    </form>
  `;

  const parsedOffers = await scraper.parseOffersFromHtml(sampleHtml, 'https://www.linda-seeds.com/de/test-product');
  assert.strictEqual(parsedOffers.length, 3, 'Should extract 3 options');
  assert.deepStrictEqual(parsedOffers[0], { seeds: 3, price: 34.50, availability: 'available', seedType: 'feminized' });
  assert.deepStrictEqual(parsedOffers[1], { seeds: 5, price: 51.90, availability: 'available', seedType: 'feminized' });
  assert.deepStrictEqual(parsedOffers[2], { seeds: 100, price: 314.90, availability: 'out_of_stock', seedType: 'feminized' });

  // ==========================================
  // 8. Invalid Product Filter Tests
  // ==========================================
  console.log('  8. Testing Invalid Product Filter...');
  assert.strictEqual(scraper.isInvalidStrainName('AC Infinity Lüfter', '', 'Headshop'), true);
  assert.strictEqual(scraper.isInvalidStrainName('Grinder Metal', '', 'Accessories'), true);
  assert.strictEqual(scraper.isInvalidStrainName('Hyper ZA', '', 'Humboldt Seed Company'), false);

  console.log('\nAll Linda Seeds Scraper unit tests PASSED successfully!');
}

runLindaSeedsScraperTests().catch(err => {
  console.error('Linda Seeds Scraper Unit Tests FAILED:', err);
  process.exit(1);
});
