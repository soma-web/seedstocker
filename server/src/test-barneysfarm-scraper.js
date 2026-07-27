import assert from 'node:assert';
import { BarneysFarmScraper } from './scrapers/BarneysFarmScraper.js';

class TestableBarneysFarmScraper extends BarneysFarmScraper {
  constructor() {
    super(null, 'price');
  }

  // Expose spec parsing logic for testing
  parseSpecsFromHtml(html) {
    const specs = {};
    const trMatches = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const tr of trMatches) {
      const tdMatches = tr.match(/<td\b[^>]*>([\s\S]*?)(?:<\/td>|(?=<\/tr>))/gi) || [];
      if (tdMatches.length >= 2) {
        const key = tdMatches[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        const val = tdMatches[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        specs[key] = val;
      }
    }
    return specs;
  }

  // Expose offer parsing logic for testing
  parseOffersFromHtml(html) {
    const offers = [];
    const liMatches = html.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || [];
    const packLis = liMatches.filter(li => li.includes('packsize_num') || li.includes('packsize_price'));

    for (const li of packLis) {
      const numMatch = li.match(/class=["']packsize_num["'][^>]*>([\s\S]*?)<\/span>/i);
      const priceMatch = li.match(/class=["']packsize_price["'][^>]*>([\s\S]*?)<\/span>/i);

      const numText = numMatch ? numMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      const priceText = priceMatch ? priceMatch[1].replace(/<[^>]+>/g, '').replace('&euro;', '€').trim() : '';

      const seedsMatch = numText.match(/(\d+)/);
      const seeds = seedsMatch ? parseInt(seedsMatch[1], 10) : 1;

      const pMatch = priceText.match(/([\d.,]+)/);
      const price = pMatch ? parseFloat(pMatch[1].replace(',', '.')) : 0;

      if (seeds > 0 && price > 0) {
        offers.push({ seeds, price });
      }
    }
    return offers;
  }
}

function runBarneysFarmScraperTests() {
  console.log('Running Barney\'s Farm Scraper Unit Tests...');
  const scraper = new TestableBarneysFarmScraper();

  // --- 1. Spec Table Parsing ---
  const sampleSpecsHtml = `
    <table>
      <tr>
        <td>Genetik</td>
        <td><span>Gelato #45 x Gorilla Glue #4</span></td>
      </tr>
      <tr>
        <td>THC</td>
        <td>25-28%</td>
      </tr>
      <tr>
        <td>CBD</td>
        <td>0.2%</td>
      </tr>
      <tr>
        <td>Blütezeit (Tage)</td>
        <td>60 - 65 Tage</td>
      </tr>
    </table>
  `;
  const specs = scraper.parseSpecsFromHtml(sampleSpecsHtml);
  assert.strictEqual(specs['genetik'], 'Gelato #45 x Gorilla Glue #4');
  assert.strictEqual(specs['thc'], '25-28%');
  assert.strictEqual(specs['cbd'], '0.2%');
  assert.strictEqual(specs['blütezeit (tage)'], '60 - 65 Tage');

  // --- 2. Offer List Parsing ---
  const sampleOffersHtml = `
    <ul>
      <li>
        <span class="packsize_num">3 Samen</span>
        <span class="packsize_price">30,00 &euro;</span>
      </li>
      <li>
        <span class="packsize_num">5 Samen</span>
        <span class="packsize_price">45,50 &euro;</span>
      </li>
      <li>
        <span class="packsize_num">10 Samen</span>
        <span class="packsize_price">80,00 &euro;</span>
      </li>
    </ul>
  `;
  const offers = scraper.parseOffersFromHtml(sampleOffersHtml);
  assert.strictEqual(offers.length, 3);
  assert.deepStrictEqual(offers[0], { seeds: 3, price: 30.0 });
  assert.deepStrictEqual(offers[1], { seeds: 5, price: 45.5 });
  assert.deepStrictEqual(offers[2], { seeds: 10, price: 80.0 });

  // --- 3. Breeder and Strain Normalization ---
  assert.strictEqual(scraper.normalizeBreeder("Barney's Farm"), "Barney's Farm");
  assert.strictEqual(scraper.normalizeStrainName("Peyote Cookies von Barney's Farm", "Barney's Farm"), 'Peyote Cookies');
  assert.strictEqual(scraper.normalizeStrainName('LSD Feminisiert', "Barney's Farm"), 'LSD');

  console.log('All Barney\'s Farm Scraper unit tests PASSED successfully!');
}

runBarneysFarmScraperTests();
