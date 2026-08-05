import fs from 'node:fs';

async function test() {
  const url = 'https://house-of-seeds.de/products/zangria-s1-wizard-trees';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await res.text();
  fs.writeFileSync('./scratch/hos_page.html', html);
  console.log('Saved html. Length:', html.length);

  // Look for JSON-LD
  const jsonLdMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  console.log('JSON-LD count:', jsonLdMatches.length);
  for (let i = 0; i < jsonLdMatches.length; i++) {
    console.log(`--- JSON-LD #${i+1} ---`);
    console.log(jsonLdMatches[i][1].trim().substring(0, 500));
  }

  // Look for window.Shopify or product JSON in HTML
  const productMatches = [...html.matchAll(/product\s*:\s*(\{[\s\S]*?\})\s*,\s*sections/gi)];
  console.log('Product matches in JS:', productMatches.length);

  // Look for variants JSON or availability indicators
  const availMatches = [...html.matchAll(/available["']?\s*:\s*(true|false)/gi)];
  console.log('Available occurrences:', availMatches.map(m => m[0]));
}

test();
