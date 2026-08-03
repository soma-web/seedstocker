import assert from 'node:assert';
import { ZecretFlavorzScraper } from './scrapers/ZecretFlavorzScraper.js';

class TestableZecretFlavorzScraper extends ZecretFlavorzScraper {
  constructor() {
    super(null, 'price');
  }
}

function runZecretFlavorzScraperTests() {
  console.log('Running Zecret Flavorz Scraper Tests...');
  const scraper = new TestableZecretFlavorzScraper();

  // 1. Strain Name Normalization Tests
  assert.strictEqual(scraper.normalizeStrainName('24K LEMON RUNTZ (AUTO)', 'Zecret Flavorz'), '24K Lemon Runtz');
  assert.strictEqual(scraper.normalizeStrainName('SUCUK سجوق Feminized Seeds - Zecret Flavorz', 'Zecret Flavorz'), 'Sucuk سجوق');
  assert.strictEqual(scraper.normalizeStrainName('DUNKINGZ (REGULAR) Seeds - Zecret Flavorz', 'Zecret Flavorz'), 'Dunkingz');
  assert.strictEqual(scraper.normalizeStrainName('CANDY PEACHES (LTD) Feminized Seeds - Zecret Flavorz', 'Zecret Flavorz'), 'Candy Peaches');
  assert.strictEqual(scraper.normalizeStrainName('LONG ISLAND ICE (AUTO) Automatic Seeds', 'Zecret Flavorz'), 'Long Island Ice');

  // 2. Seed Type Detection Tests
  assert.strictEqual(scraper.cleanSeedType('24K LEMON RUNTZ (AUTO) Automatic Seeds'), 'autoflower');
  assert.strictEqual(scraper.cleanSeedType('LONG ISLAND ICE (AUTO)'), 'autoflower');
  assert.strictEqual(scraper.cleanSeedType('DUNKINGZ (REGULAR) Seeds'), 'regular');
  assert.strictEqual(scraper.cleanSeedType('ZWEET TRAP (REGULAR)'), 'regular');
  assert.strictEqual(scraper.cleanSeedType('SUCUK Feminized Seeds'), 'feminized');
  assert.strictEqual(scraper.cleanSeedType('STRAWBERRY Z'), 'feminized');

  // 3. Flowering Time Extraction Tests
  assert.strictEqual(
    scraper.extractFloweringTime('A-Z Time: 9-11 weeks Pack-Size Choose an option', 'autoflower'),
    '9-11 weeks'
  );
  assert.strictEqual(
    scraper.extractFloweringTime('A-Z Time: ~9-11 weeks', 'autoflower'),
    '9-11 weeks'
  );
  assert.strictEqual(
    scraper.extractFloweringTime('Flowering: ~9 weeks Pack-Size Choose an option', 'feminized'),
    '9 weeks'
  );
  assert.strictEqual(
    scraper.extractFloweringTime('Flowering: 8-9 Weeks', 'regular'),
    '8-9 weeks'
  );

  // 4. THC Content Extraction Tests
  assert.strictEqual(
    scraper.extractThcContent('Our THC Tests: In lab tests, top buds grown under our 720W LED lights reached 28% THC.'),
    '28%'
  );
  assert.strictEqual(
    scraper.extractThcContent('Our THC Tests: In lab tests, top buds reached 27-28% THC. However, clients report...'),
    '27-28%'
  );
  assert.strictEqual(
    scraper.extractThcContent('Our THC Tests: In lab tests, top buds reached 21-27% THC.'),
    '21-27%'
  );
  assert.strictEqual(
    scraper.extractThcContent('This banger packs up to 29% THC, shimmering in a frosty crystal-coated world'),
    '29%'
  );

  // 5. Seed Count Parsing Tests
  assert.strictEqual(scraper.parseSeedCount('1 Pack (3 Seeds)'), 3);
  assert.strictEqual(scraper.parseSeedCount('4 Pack (12 Seeds)'), 12);
  assert.strictEqual(scraper.parseSeedCount('4 Packs (12 Seeds)'), 12);
  assert.strictEqual(scraper.parseSeedCount('1 Pack (5 Seeds)'), 5);
  assert.strictEqual(scraper.parseSeedCount('3 Seeds'), 3);
  assert.strictEqual(scraper.parseSeedCount('1 Pack'), 1);

  // 6. parseOffersFromHtml Tests (WooCommerce HTML with product_variations JSON)
  const sampleVariationsHtml = `
    <form class="variations_form cart" data-product_id="1400" data-product_variations="[{&quot;attributes&quot;:{&quot;attribute_pack-size&quot;:&quot;1 Pack (3 Seeds)&quot;},&quot;display_price&quot;:39,&quot;is_in_stock&quot;:true,&quot;variation_is_active&quot;:true},{&quot;attributes&quot;:{&quot;attribute_pack-size&quot;:&quot;4 Pack (12 Seeds)&quot;},&quot;display_price&quot;:120,&quot;is_in_stock&quot;:true,&quot;variation_is_active&quot;:true}]">
    </form>
  `;
  const offers = scraper.parseOffersFromHtml(sampleVariationsHtml, 'https://zecretflavorz.com/produkt/sucuk/');
  assert.strictEqual(offers.length, 2);
  assert.strictEqual(offers[0].seeds, 3);
  assert.strictEqual(offers[0].price, 39);
  assert.strictEqual(offers[0].availability, 'available');
  assert.strictEqual(offers[1].seeds, 12);
  assert.strictEqual(offers[1].price, 120);
  assert.strictEqual(offers[1].availability, 'available');

  // 7. Simple Product Fallback (No Variations)
  const sampleSimpleHtml = `
    <h1>ZWEET TRAP (REGULAR)</h1>
    <div>10 REGULAR SEEDS</div>
    <p class="price"><span class="woocommerce-Price-amount amount"><bdi>99,00&nbsp;&euro;</bdi></span></p>
  `;
  const simpleOffers = scraper.parseOffersFromHtml(sampleSimpleHtml, 'https://zecretflavorz.com/produkt/zweettrap-regular/');
  assert.strictEqual(simpleOffers.length, 1);
  assert.strictEqual(simpleOffers[0].seeds, 10);
  assert.strictEqual(simpleOffers[0].price, 99);
  assert.strictEqual(simpleOffers[0].availability, 'available');

  // 8. Non-strain filtering test
  assert.strictEqual(scraper.isNonStrain('ZECRET FLAVORZ Cap'), true);
  assert.strictEqual(scraper.normalizeStrainName('ZECRET FLAVORZ Hoodie'), 'Hoodie');
  assert.strictEqual(scraper.isNonStrain('ZECRET FLAVORZ Hoodie'), true);
  assert.strictEqual(scraper.isNonStrain('SUCUK'), false);

  // 9. Registry resolution test
  import('./scrapers/registry.js').then(({ getScraperByDomain, getScraperByName }) => {
    const entryByDomain = getScraperByDomain('https://zecretflavorz.com/produkt/24k-lemon-runtz-auto/');
    assert.ok(entryByDomain, 'Should find scraper entry by domain');
    assert.strictEqual(entryByDomain.name, 'Zecret Flavorz');

    const entryByName = getScraperByName('Zecret Flavorz');
    assert.ok(entryByName, 'Should find scraper entry by name');
    assert.strictEqual(entryByName.domain, 'zecretflavorz.com');

    console.log('✓ Registry resolution tests passed!');
  });

  console.log('✓ All Zecret Flavorz Scraper Tests passed successfully!');
}

runZecretFlavorzScraperTests();
