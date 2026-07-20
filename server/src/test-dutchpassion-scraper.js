import assert from 'node:assert';
import { DutchPassionScraper } from './scrapers/DutchPassionScraper.js';

class TestableDutchPassionScraper extends DutchPassionScraper {
  constructor() {
    super(null, 'price');
  }

  // Expose helper to test ProductGroup variant parsing logic directly
  parseVariantsFromProductGroup(productGroup) {
    const variants = [];
    if (productGroup.hasVariant && Array.isArray(productGroup.hasVariant)) {
      for (const v of productGroup.hasVariant) {
        const sizeStr = v.size || v.name || '';
        const countMatch = sizeStr.match(/(\d+)\s*(?:Reguläre\s*)?Samen/i);
        const seeds = countMatch ? parseInt(countMatch[1], 10) : null;
        const price = v.offers?.price !== undefined ? parseFloat(v.offers.price) : null;
        const inStock = v.offers?.availability ? v.offers.availability.includes('InStock') : true;

        if (seeds && price && !isNaN(seeds) && !isNaN(price) && seeds > 0 && price > 0) {
          variants.push({ seeds, price, inStock });
        }
      }
    }
    return variants;
  }
}

function runDutchPassionScraperTests() {
  console.log('Running Dutch Passion Scraper Unit Tests...');
  const scraper = new TestableDutchPassionScraper();

  // --- 1. Breeder Normalization Tests ---
  assert.strictEqual(scraper.normalizeBreeder('Dutch Passion'), 'Dutch Passion');
  assert.strictEqual(scraper.normalizeBreeder('DP'), 'Dutch Passion');
  assert.strictEqual(scraper.normalizeBreeder('dutch passion seeds'), 'Dutch Passion');
  assert.strictEqual(scraper.normalizeBreeder(null), 'Unknown Breeder');

  // --- 2. Trademark Symbol Removal & Strain Name Normalization Tests ---
  assert.strictEqual(
    scraper.normalizeStrainName('Auto Mazar®', 'Dutch Passion'),
    'Mazar'
  );
  assert.strictEqual(
    scraper.normalizeStrainName('Frisian Dew™', 'Dutch Passion'),
    'Frisian Dew'
  );
  assert.strictEqual(
    scraper.normalizeStrainName('Passion #1® Feminisierte Hanfsamen', 'Dutch Passion'),
    'Passion #1'
  );
  assert.strictEqual(
    scraper.normalizeStrainName('Skywalker Haze® von Dutch Passion', 'Dutch Passion'),
    'Skywalker Haze'
  );

  // --- 3. Variant & Price Parsing Tests ---
  const sampleProductGroup = {
    name: 'Auto Mazar®',
    hasVariant: [
      {
        size: '1 Samen ',
        offers: { price: 15.95, availability: 'https://schema.org/InStock' }
      },
      {
        size: '3 Samen',
        offers: { price: 29.95, availability: 'https://schema.org/InStock' }
      },
      {
        size: '7 Samen',
        offers: { price: 59.95, availability: 'https://schema.org/OutOfStock' }
      }
    ]
  };

  const parsedVariants = scraper.parseVariantsFromProductGroup(sampleProductGroup);
  assert.strictEqual(parsedVariants.length, 3);
  assert.deepStrictEqual(parsedVariants[0], { seeds: 1, price: 15.95, inStock: true });
  assert.deepStrictEqual(parsedVariants[1], { seeds: 3, price: 29.95, inStock: true });
  assert.deepStrictEqual(parsedVariants[2], { seeds: 7, price: 59.95, inStock: false });

  // --- 4. Invalid Product Filter Tests ---
  assert.strictEqual(scraper.isInvalidStrainName('Dutch Passion Gift Card', ''), true);
  assert.strictEqual(scraper.isInvalidStrainName('Color Mix Pack #1', ''), true);
  assert.strictEqual(scraper.isInvalidStrainName('Auto Mazar', 'Mazar X Indica autoflower'), false);
  assert.strictEqual(scraper.isInvalidStrainName('Frisian Dew', 'Super Skunk X Purple Star'), false);

  console.log('All Dutch Passion Scraper unit tests PASSED successfully!');
}

runDutchPassionScraperTests();
