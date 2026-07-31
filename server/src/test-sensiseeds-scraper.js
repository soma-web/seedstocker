import assert from 'node:assert';
import { SensiSeedsScraper } from './scrapers/SensiSeedsScraper.js';

class TestableSensiSeedsScraper extends SensiSeedsScraper {
  constructor() {
    super(null, 'price');
  }

  // Expose private helper logic for direct unit testing
  decode(str) {
    return str
      .replace(/&#x2B;/gi, '+')
      .replace(/&#x20AC;/gi, '€')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec))
      .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  parseOptionsFromHtml(html) {
    const offers = [];
    const labelMatches = [...html.matchAll(/<label[^>]*for="product_attribute_[^"]*"[^>]*>([\s\S]*?)<\/label>/gi)];
    for (const lm of labelMatches) {
      const decodedLabel = this.decode(lm[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      const seedsMatch = decodedLabel.match(/(\d+)(?:\s*\+\s*\d+)?\s*samen/i);
      const priceMatch = decodedLabel.match(/€\s*([\d.,]+)/);
      if (seedsMatch && priceMatch) {
        const seeds = parseInt(seedsMatch[1], 10);
        const price = parseFloat(priceMatch[1].replace('.', '').replace(',', '.'));
        if (!isNaN(seeds) && !isNaN(price) && seeds > 0 && price > 0) {
          offers.push({ seeds, price });
        }
      }
    }
    return offers;
  }
}

function runSensiSeedsScraperTests() {
  console.log('Running Sensi Seeds Scraper Unit Tests...');
  const scraper = new TestableSensiSeedsScraper();

  // --- 1. HTML Entity Decoder Tests ---
  assert.strictEqual(scraper.decode('3&#x2B;1 Samen &#x20AC;20,50'), '3+1 Samen €20,50');
  assert.strictEqual(scraper.decode('1 Samen &#x20AC;5,50'), '1 Samen €5,50');
  assert.strictEqual(scraper.decode('&amp; Sensi &quot;Seeds&quot;'), '& Sensi "Seeds"');

  // --- 2. Radio Label Option & Price Parsing Tests ---
  const sampleOptionHtml = `
    <label for="product_attribute_588_2932">3&#x2B;1 Samen &#x20AC;20,50 <span class="price-per-seed">&#x20AC;6,83 / samen</span> </label>
    <label for="product_attribute_588_2933">5&#x2B;2 Samen &#x20AC;29,00 <span class="price-per-seed">&#x20AC;5,80 / samen</span> </label>
    <label for="product_attribute_588_2934">10&#x2B;4 Samen &#x20AC;53,50 <span class="price-per-seed">&#x20AC;5,35 / samen</span> </label>
  `;
  const parsedOffers = scraper.parseOptionsFromHtml(sampleOptionHtml);
  assert.strictEqual(parsedOffers.length, 3);
  assert.deepStrictEqual(parsedOffers[0], { seeds: 3, price: 20.5 });
  assert.deepStrictEqual(parsedOffers[1], { seeds: 5, price: 29.0 });
  assert.deepStrictEqual(parsedOffers[2], { seeds: 10, price: 53.5 });

  // --- 3. Breeder Normalization Tests for Sensi Seeds Brands ---
  assert.strictEqual(scraper.normalizeBreeder('Sensi Seeds'), 'Sensi Seeds');
  assert.strictEqual(scraper.normalizeBreeder('Research'), 'Sensi Seeds');
  assert.strictEqual(scraper.normalizeBreeder('Sensi Seeds Research'), 'Sensi Seeds');
  assert.strictEqual(scraper.normalizeBreeder('White Label'), 'White Label (Sensi Seeds)');
  assert.strictEqual(scraper.normalizeBreeder('whitelabel'), 'White Label (Sensi Seeds)');
  assert.strictEqual(scraper.normalizeBreeder('Sensi x Sherbinskis'), 'Sensi x Sherbinskis');
  assert.strictEqual(scraper.normalizeBreeder('Sensi x Serge'), 'Sensi Seeds x Serge Cannabis');
  assert.strictEqual(scraper.normalizeBreeder('sensi seeds x serge cannabis'), 'Sensi Seeds x Serge Cannabis');
  assert.strictEqual(scraper.normalizeBreeder(null), 'Unknown Breeder');

  // --- 4. Strain Name Cleaning & Normalization Tests ---
  assert.strictEqual(
    scraper.normalizeStrainName('Sticky Orange XXL Automatic Hanfsamen', 'Sensi Seeds'),
    'Sticky Orange XXL'
  );
  assert.strictEqual(
    scraper.normalizeStrainName('Purple Bud Feminisierte Hanfsamen von White Label', 'White Label (Sensi Seeds)'),
    'Purple Bud'
  );
  assert.strictEqual(
    scraper.normalizeStrainName('Sour Sherb Feminisierte Hanfsamen', 'Sensi x Sherbinskis'),
    'Sour Sherb'
  );
  assert.strictEqual(
    scraper.normalizeStrainName('Skunk #1 Regular Hanfsamen', 'Sensi Seeds'),
    'Skunk #1'
  );
  assert.strictEqual(
    scraper.normalizeStrainName('Early Girl Reguläre Hanfsamen', 'Sensi Seeds'),
    'Early Girl'
  );
  assert.strictEqual(
    scraper.normalizeStrainName('Early Girl e', 'Sensi Seeds'),
    'Early Girl'
  );

  // --- 5. Invalid / Pack / Bundle Name Filter Tests ---
  assert.strictEqual(scraper.isInvalidStrainName('Sensi Seeds Adventskalender 2026', ''), true);
  assert.strictEqual(scraper.isInvalidStrainName('Mix Pack Feminized', ''), true);
  assert.strictEqual(scraper.isInvalidStrainName('Gift Card €50', ''), true);
  assert.strictEqual(scraper.isInvalidStrainName('Sticky Orange XXL', ''), false);

  // --- 7. Seed Type Extraction Tests (Regular vs Feminized) ---
  assert.strictEqual(scraper.extractSeedType('Skunk Kush Reguläre Hanfsamen', {}, 'https://sensiseeds.com/de/regulare-samen/sensi-seeds/skunk-kush'), 'regular');
  assert.strictEqual(scraper.extractSeedType('Skunk Kush Feminisierte Hanfsamen', {}, 'https://sensiseeds.com/de/feminisierte-samen/sensi-seeds/skunk-kush-weiblich'), 'feminized');
  assert.strictEqual(scraper.extractSeedType('Skunk #1', { 'samen typ': 'Reguläre Hanfsamen' }, ''), 'regular');
  assert.strictEqual(scraper.extractSeedType('Skunk #1', { 'samen typ': 'Feminisierte Hanfsamen' }, ''), 'feminized');

  console.log('All Sensi Seeds Scraper unit tests PASSED successfully!');
}

runSensiSeedsScraperTests();
