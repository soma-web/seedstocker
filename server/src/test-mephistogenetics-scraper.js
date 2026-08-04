import assert from 'node:assert';
import { MephistoGeneticsScraper } from './scrapers/MephistoGeneticsScraper.js';

class TestableMephistoGeneticsScraper extends MephistoGeneticsScraper {
  constructor() {
    super(null, 'price');
  }
}

function runMephistoGeneticsScraperTests() {
  console.log('Running Mephisto Genetics Scraper Tests...');
  const scraper = new TestableMephistoGeneticsScraper();

  // 1. Strain Name Normalization Tests
  assert.strictEqual(scraper.normalizeStrainName('Rainbow Sundae 11 - Mephisto Genetics', 'Mephisto Genetics'), 'Rainbow Sundae 11');
  assert.strictEqual(scraper.normalizeStrainName('Mephisto Genetics - Old School Blues', 'Mephisto Genetics'), 'Old School Blues');
  assert.strictEqual(scraper.normalizeStrainName('ILL#60 - Alien Grapes (FEMINIZED)', 'Mephisto Genetics'), 'ILL#60 - Alien Grapes');

  // 2. Non-Strain and Bundle Exclusion Tests
  assert.strictEqual(scraper.isNonStrain('Farm Friends Sticker Bundle', '', ['merch', 'swag']), true);
  assert.strictEqual(scraper.isNonStrain('1/4 Pound Mephisto x Grove Bags', '', ['merch']), true);
  assert.strictEqual(scraper.isNonStrain('Plant Tag Bundle', '', ['Plant Tags']), true);
  assert.strictEqual(scraper.isNonStrain('The MG Gift Card', '', ['Other']), true);
  assert.strictEqual(scraper.isNonStrain('Special Variety', '<p>Check out our <a href="/pages/bundles">bundles</a>!</p>', []), true);
  assert.strictEqual(scraper.isNonStrain('Rainbow Sundae 11', '<p>Delicious autoflower strain.</p>', ['Artisanal']), false);

  // 3. Seed Count Parsing Tests
  assert.strictEqual(scraper.parseSeedCount('1 (+1) seed'), 1);
  assert.strictEqual(scraper.parseSeedCount('3 (+2) seed'), 3);
  assert.strictEqual(scraper.parseSeedCount('5 (+1) seed'), 5);
  assert.strictEqual(scraper.parseSeedCount('7 (+3) seed'), 7);
  assert.strictEqual(scraper.parseSeedCount('10 seed'), 10);
  assert.strictEqual(scraper.parseSeedCount('b2b 5 seed'), 5);
  assert.strictEqual(scraper.parseSeedCount('b2b 3 seed'), 3);
  assert.strictEqual(scraper.parseSeedCount('graphic strain sticker'), null);
  assert.strictEqual(scraper.parseSeedCount('1/4lb single bag - Jim Connolly'), null);

  // 4. Specs Extraction Tests (Indica/Sativa, THC, CBD, Flowering)
  const specs1 = scraper.parseShopifySpecs('<p>35/65 indica-dominant package with 20% THC</p>', ['msindica']);
  assert.strictEqual(specs1.strainType, 'Indica-dominant');
  assert.strictEqual(specs1.thc, '20% THC');

  const specs2 = scraper.parseShopifySpecs('<p>20/80 sativa-leaning profile, flowering time 70-79 days</p>', []);
  assert.strictEqual(specs2.strainType, '80% Sativa / 20% Indica');
  assert.strictEqual(specs2.floweringTime, '70-79 days');

  const specs3 = scraper.parseShopifySpecs('<p>50/50 balanced hybrid with 1:1 CBD</p>', ['mshybrid']);
  assert.strictEqual(specs3.strainType, 'Hybrid');
  assert.strictEqual(specs3.cbd, '1:1 CBD');

  // 5. HTML DOM Spec Extraction Test (Mephisto Spec Table)
  const domHtml = `
    <div>
      <div>Indica/Sativa</div>
      <div>35/65</div>
      <div>Cycle Time</div>
      <div>75 to 85 days from sprout</div>
      <div class="cannabinoids-label">Cannabinoids</div>
      <div class="cannabinoids-field">15% THC</div>
    </div>
  `;
  const domSpecs = scraper.parseShopifySpecs('', [], domHtml);
  assert.strictEqual(domSpecs.thc, '15% THC');
  assert.strictEqual(domSpecs.strainType, '65% Sativa / 35% Indica');
  assert.strictEqual(domSpecs.floweringTime, '75-85 days');

  // 6. parseOffersFromHtml Test (Shopify Product JSON Script)
  const sampleProductHtml = `
    <script type="application/json" id="ProductJson-1">
      {
        "id": 1,
        "title": "Rainbow Sundae 11",
        "variants": [
          { "id": 101, "title": "1 (+1) seed", "price": "24.00", "available": true },
          { "id": 102, "title": "3 (+2) seed", "price": "48.00", "available": true },
          { "id": 103, "title": "graphic strain sticker", "price": "1.50", "available": true }
        ]
      }
    </script>
  `;
  const offers = scraper.parseOffersFromHtml(sampleProductHtml);
  assert.strictEqual(offers.length, 2);
  assert.strictEqual(offers[0].seeds, 1);
  assert.strictEqual(offers[0].price, 24);
  assert.strictEqual(offers[0].availability, 'available');
  assert.strictEqual(offers[1].seeds, 3);
  assert.strictEqual(offers[1].price, 48);

  console.log('All Mephisto Genetics Scraper Tests Passed Successfully!');
}

runMephistoGeneticsScraperTests();
