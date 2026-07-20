import assert from 'node:assert';
import { GasStationLuScraper } from './scrapers/GasStationLuScraper.js';

class TestableGasStationLuScraper extends GasStationLuScraper {
  constructor() {
    super(() => {}, 'price');
  }
}

function runGasStationLuScraperTests() {
  console.log('Running Gas Station LU Scraper Unit Tests...');
  const scraper = new TestableGasStationLuScraper();

  // --- 1. Breeder Normalization Tests ---
  assert.strictEqual(scraper.normalizeBreeder('Capulator'), 'Capulator');
  assert.strictEqual(scraper.normalizeBreeder('Copycat Genetix'), 'Copycat Genetix');
  assert.strictEqual(scraper.normalizeBreeder('Robin Hood Seeds'), 'Robin Hood Seeds');
  assert.strictEqual(scraper.normalizeBreeder('Umami Seed Company'), 'Umami Seed Company');
  assert.strictEqual(scraper.normalizeBreeder('Humboldt Seed Company'), 'Humboldt Seed Company');
  assert.strictEqual(scraper.normalizeBreeder('Gas Station', 'Dr. Doom by Copycat Genetix'), 'Copycat Genetix');
  assert.strictEqual(scraper.normalizeBreeder('Gas Station', 'Capulator - CAP Junky'), 'Capulator');
  assert.strictEqual(scraper.normalizeBreeder(null), 'Gas Station LU');

  // --- 2. Strain Name Normalization Tests ---
  assert.strictEqual(
    scraper.normalizeStrainName('Dr. Doom S1 (Dr. Sleep x Frog Poison) 10 feminized seeds', 'Copycat Genetix'),
    'Dr. Doom S1'
  );
  assert.strictEqual(
    scraper.normalizeStrainName('Black Maraschino (Black Hole x Frozen Trop Cherry) 5 seeds', 'Robin Hood Seeds'),
    'Black Maraschino'
  );
  assert.strictEqual(
    scraper.normalizeStrainName('Frozen CAP Junky (CAP Junky x Banana Butter Cups) 5 seeds', 'Robin Hood Seeds'),
    'Frozen CAP Junky'
  );
  assert.strictEqual(
    scraper.normalizeStrainName('CAP Junky (Alien Cookies F2 × Kush Mints 11) 11 regular seeds', 'Capulator'),
    'CAP Junky'
  );
  assert.strictEqual(
    scraper.normalizeStrainName('Nigiri ((Z x Kush Mints) x Ultraviolet Sherb) 8 seeds + 2 Papaya Dawg + 2 Peach Float', 'Grounded Genetics'),
    'Nigiri'
  );
  assert.strictEqual(
    scraper.normalizeStrainName('Maraschino Fritter (Blueberry Fritter x Frozen Trop Cherry) 5 seeds | Gas-Station exclusive Mary Jane Drop', 'Robin Hood Seeds'),
    'Maraschino Fritter'
  );
  assert.strictEqual(
    scraper.normalizeStrainName('Sunset Lime (Sunset Sherbert x Limecai)', 'Umami Seed Company'),
    'Sunset Lime'
  );

  // --- 3. Seed Count Extraction Tests ---
  assert.strictEqual(scraper.parseSeedCount('3', ''), 3);
  assert.strictEqual(scraper.parseSeedCount('6 + 3x Sour D x Zoda', ''), 6);
  assert.strictEqual(scraper.parseSeedCount('Default Title', 'Dr. Doom S1 (Dr. Sleep x Frog Poison) 10 feminized seeds'), 10);
  assert.strictEqual(scraper.parseSeedCount('Default Title', 'Black Maraschino (Black Hole x Frozen Trop Cherry) 5 seeds'), 5);
  assert.strictEqual(scraper.parseSeedCount('Default Title', 'CAP Junky (Alien Cookies F2 × Kush Mints 11) 11 regular seeds'), 11);
  assert.strictEqual(scraper.parseSeedCount('Default Title', 'Lions Tooth (Sweet Tooth x Lion Strength) 10+ seeds FEMINIZED'), 10);
  assert.strictEqual(scraper.parseSeedCount('Default Title', 'Unknown Strain Title Without Seed Count'), 1);

  // --- 4. Seed Type Extraction Tests ---
  assert.strictEqual(scraper.extractSeedType('Dr. Doom S1 10 feminized seeds'), 'feminized');
  assert.strictEqual(scraper.extractSeedType('CAP Junky 11 regular seeds'), 'regular');
  assert.strictEqual(scraper.extractSeedType('Auto Lemon Haze 5 seeds'), 'autoflowering');

  // --- 5. Metafields Parsing Tests ---
  const sampleHtml = `
    <div>
      <p>Flowering Time: 60-65 days</p>
      <p>Genetics: Hybrid</p>
      <p>Lineage: CAP Junky x Banana Butter Cups</p>
    </div>
  `;
  const specs = scraper.parseMetafieldsFromHtml(sampleHtml);
  assert.strictEqual(specs.floweringTime, '9-9');
  assert.strictEqual(specs.strainType, 'hybrid');
  assert.strictEqual(specs.genetics, 'CAP Junky x Banana Butter Cups');

  // --- 6. Invalid Name Filtering Tests ---
  assert.strictEqual(scraper.isInvalidStrainName('Gas Station Adventskalender'), true);
  assert.strictEqual(scraper.isInvalidStrainName('Gift Card €50'), true);
  assert.strictEqual(scraper.isInvalidStrainName('Dr. Doom S1'), false);

  console.log('All Gas Station LU Scraper unit tests PASSED successfully!');
}

runGasStationLuScraperTests();
