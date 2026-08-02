import assert from 'node:assert';
import {
  parseSeedsCount,
  fetchShopifyProductJson,
  fetchHtmlJsonLd,
  scrapeUrlPrices,
  parseArgs
} from './run-url-price-scraper.js';

async function runUrlPriceScraperTests() {
  console.log('Running URL Price Scraper Unit Tests...');

  // Save original fetch and process.argv
  const originalFetch = globalThis.fetch;
  const originalArgv = process.argv;

  try {
    // ==========================================
    // 1. parseSeedsCount Unit Tests
    // ==========================================
    console.log('  Testing parseSeedsCount...');

    // Promo format (e.g. "3+1", "5+2", "10+4")
    assert.strictEqual(parseSeedsCount('3+1'), 3, 'Promo format 3+1 should return 3');
    assert.strictEqual(parseSeedsCount('5+2 seeds'), 5, 'Promo format 5+2 should return 5');
    assert.strictEqual(parseSeedsCount('10 + 4 bonus'), 10, 'Promo format 10+4 should return 10');

    // German & English keywords
    assert.strictEqual(parseSeedsCount('3 Samen'), 3, '3 Samen should return 3');
    assert.strictEqual(parseSeedsCount('5 Seeds'), 5, '5 Seeds should return 5');
    assert.strictEqual(parseSeedsCount('10 Stk.'), 10, '10 Stk. should return 10');
    assert.strictEqual(parseSeedsCount('1 Pack (5 Seeds)'), 5, '1 Pack (5 Seeds) should return 5');
    assert.strictEqual(parseSeedsCount('Packung von 10'), 10, 'Packung von 10 should return 10');
    assert.strictEqual(parseSeedsCount('5er Pack'), 5, '5er Pack should return 5');

    // Phenotype & Cross-lineage Sanitization
    assert.strictEqual(parseSeedsCount('Gelato #10 3 Seeds'), 3, 'Phenotype #10 with 3 Seeds should return 3');
    assert.strictEqual(parseSeedsCount('10 x OG Kush 5 Samen'), 5, '10 x Lineage cross with 5 Samen should return 5');

    // Plain numbers
    assert.strictEqual(parseSeedsCount('5'), 5, 'Plain string "5" should return 5');
    assert.strictEqual(parseSeedsCount(' 10 '), 10, 'Trimmed string "10" should return 10');

    // Edge & invalid cases
    assert.strictEqual(parseSeedsCount(''), null, 'Empty string should return null');
    assert.strictEqual(parseSeedsCount(null), null, 'Null should return null');
    assert.strictEqual(parseSeedsCount('No seeds mentioned'), null, 'Text without numbers should return null');
    assert.strictEqual(parseSeedsCount('0 Seeds'), null, '0 seeds should return null');


    // ==========================================
    // 2. parseArgs CLI Options Parsing Tests
    // ==========================================
    console.log('  Testing parseArgs CLI parser...');

    process.argv = [
      'node', 'run-url-price-scraper.js',
      '--shop=Oaseeds',
      '--url=https://oaseeds.com/en/test.html',
      '--strain-id=abc-123',
      '--limit=15',
      '--concurrency=4',
      '--dry-run'
    ];

    const parsedOptions = parseArgs();
    assert.strictEqual(parsedOptions.targetShop, 'Oaseeds');
    assert.strictEqual(parsedOptions.targetUrl, 'https://oaseeds.com/en/test.html');
    assert.strictEqual(parsedOptions.targetStrainId, 'abc-123');
    assert.strictEqual(parsedOptions.limit, 15);
    assert.strictEqual(parsedOptions.concurrency, 4);
    assert.strictEqual(parsedOptions.dryRun, true);

    // Test space-separated CLI arguments format
    process.argv = [
      'node', 'run-url-price-scraper.js',
      '--shop', 'Zamnesia',
      '--limit', '5'
    ];
    const spaceOptions = parseArgs();
    assert.strictEqual(spaceOptions.targetShop, 'Zamnesia');
    assert.strictEqual(spaceOptions.limit, 5);
    assert.strictEqual(spaceOptions.dryRun, false);


    // ==========================================
    // 3. fetchShopifyProductJson Tests
    // ==========================================
    console.log('  Testing fetchShopifyProductJson...');

    // Mock successful Shopify product endpoint
    globalThis.fetch = async (url) => {
      assert.ok(String(url).endsWith('.json'), 'URL should end with .json');
      return {
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          product: {
            title: 'Shopify Strain',
            variants: [
              { id: 101, title: '3 Seeds', option1: '3 Seeds', price: '25.00', available: true },
              { id: 102, title: '5 Seeds', option1: '5 Seeds', price: '40.00', available: false }
            ]
          }
        })
      };
    };

    const shopifyData = await fetchShopifyProductJson('https://example-shop.com/products/shopify-strain');
    assert.ok(shopifyData, 'Shopify data should be returned');
    assert.strictEqual(shopifyData.isNotFound, false);
    assert.strictEqual(shopifyData.variants.length, 2);
    assert.strictEqual(shopifyData.variants[0].seeds, 3);
    assert.strictEqual(shopifyData.variants[0].price, 25.0);
    assert.strictEqual(shopifyData.variants[0].availability, 'available');
    assert.strictEqual(shopifyData.variants[1].seeds, 5);
    assert.strictEqual(shopifyData.variants[1].price, 40.0);
    assert.strictEqual(shopifyData.variants[1].availability, 'out_of_stock');

    // Mock 404 Not Found for Shopify
    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
      headers: new Map([['content-type', 'text/html']])
    });

    const shopify404 = await fetchShopifyProductJson('https://example-shop.com/products/non-existing');
    assert.ok(shopify404);
    assert.strictEqual(shopify404.isNotFound, true);
    assert.strictEqual(shopify404.variants.length, 0);


    // ==========================================
    // 4. fetchShopifyProductJson Fallbacks & Invalid Format
    // ==========================================
    console.log('  Testing fetchShopifyProductJson fallbacks & invalid responses...');

    // Title seed count fallback when variant title is "Default Title"
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        product: {
          title: 'Amnesia Haze 10 Seeds',
          variants: [
            { id: 201, title: 'Default Title', price: '75.00', available: true }
          ]
        }
      })
    });

    const titleFallbackData = await fetchShopifyProductJson('https://example-shop.com/products/amnesia-haze');
    assert.ok(titleFallbackData);
    assert.strictEqual(titleFallbackData.variants[0].seeds, 10, 'Should fall back to product title seed count 10');

    // Non-JSON content type response
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/html']]),
      json: async () => ({})
    });

    const nonJsonData = await fetchShopifyProductJson('https://example-shop.com/products/html-page');
    assert.strictEqual(nonJsonData, null, 'Non-JSON content type should return null');


    // ==========================================
    // 5. fetchHtmlJsonLd Tests (Standard & @graph)
    // ==========================================
    console.log('  Testing fetchHtmlJsonLd...');

    const sampleJsonLdHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@type": "Product",
              "name": "Northern Lights",
              "offers": [
                {
                  "@type": "Offer",
                  "name": "3 Seeds",
                  "price": "22.50",
                  "availability": "https://schema.org/InStock"
                },
                {
                  "@type": "Offer",
                  "name": "10 Seeds",
                  "price": "65.00",
                  "availability": "https://schema.org/OutOfStock"
                }
              ]
            }
          </script>
        </head>
      </html>
    `;

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => sampleJsonLdHtml
    });

    const jsonLdData = await fetchHtmlJsonLd('https://example-shop.com/strains/northern-lights.html');
    assert.ok(jsonLdData);
    assert.strictEqual(jsonLdData.isNotFound, false);
    assert.strictEqual(jsonLdData.offers.length, 2);
    assert.strictEqual(jsonLdData.offers[0].seeds, 3);
    assert.strictEqual(jsonLdData.offers[0].price, 22.5);
    assert.strictEqual(jsonLdData.offers[0].availability, 'available');
    assert.strictEqual(jsonLdData.offers[1].seeds, 10);
    assert.strictEqual(jsonLdData.offers[1].price, 65.0);
    assert.strictEqual(jsonLdData.offers[1].availability, 'out_of_stock');


    // ==========================================
    // 6. fetchHtmlJsonLd Edge Cases (@graph, Single Offer, Malformed JSON)
    // ==========================================
    console.log('  Testing fetchHtmlJsonLd @graph, single offer, and malformed JSON...');

    const graphJsonLdHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <script type="application/ld+json">
            INVALID JSON CONTENT THAT SHOULD NOT CRASH
          </script>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "ProductGroup",
                  "name": "Super Lemon Haze",
                  "offers": {
                    "@type": "Offer",
                    "name": "5 Seeds",
                    "price": "35.00",
                    "availability": "InStock"
                  }
                }
              ]
            }
          </script>
        </head>
      </html>
    `;

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => graphJsonLdHtml
    });

    const graphData = await fetchHtmlJsonLd('https://example-shop.com/strains/super-lemon-haze.html');
    assert.ok(graphData);
    assert.strictEqual(graphData.offers.length, 1);
    assert.strictEqual(graphData.offers[0].seeds, 5);
    assert.strictEqual(graphData.offers[0].price, 35.0);
    assert.strictEqual(graphData.offers[0].availability, 'available');


    // ==========================================
    // 7. scrapeUrlPrices Dispatch Tests
    // ==========================================
    console.log('  Testing scrapeUrlPrices dispatching & error resilience...');

    // Custom scraper instance parseOffersFromHtml
    const mockScraperInst = {
      getHeaders: () => ({ 'User-Agent': 'Test-Agent' }),
      parseOffersFromHtml: async (html, url) => [
        { seeds: 3, price: 29.99, availability: 'available' },
        { seeds: 5, price: 44.99, availability: 'available' }
      ]
    };

    globalThis.fetch = async (url) => ({
      ok: true,
      status: 200,
      text: async () => '<html>Custom Scraper Page</html>'
    });

    const customResult = await scrapeUrlPrices('Oaseeds', 'https://oaseeds.com/en/custom-product.html', mockScraperInst);
    assert.ok(customResult);
    assert.strictEqual(customResult.isNotFound, false);
    assert.strictEqual(customResult.offers.length, 2);
    assert.strictEqual(customResult.offers[0].price, 29.99);

    // Custom scraper throwing error -> fallback to JSON-LD
    const failingScraperInst = {
      getHeaders: () => ({}),
      parseOffersFromHtml: async () => {
        throw new Error('Custom parsing failed!');
      }
    };

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => sampleJsonLdHtml
    });

    const fallbackResult = await scrapeUrlPrices('Oaseeds', 'https://oaseeds.com/en/failing-custom.html', failingScraperInst);
    assert.ok(fallbackResult);
    assert.strictEqual(fallbackResult.offers.length, 2, 'Should fall back to JSON-LD parsing');
    assert.strictEqual(fallbackResult.offers[0].seeds, 3);

    console.log('All URL Price Scraper unit tests PASSED successfully!');
  } finally {
    // Restore global fetch and argv
    globalThis.fetch = originalFetch;
    process.argv = originalArgv;
  }
}

runUrlPriceScraperTests().catch(err => {
  console.error('URL Price Scraper Unit Test FAILED:', err);
  process.exit(1);
});
