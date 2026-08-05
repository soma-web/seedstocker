import fs from 'node:fs';

async function test(handle) {
  const url = `https://house-of-seeds.de/products/${handle}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const jsonLdMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of jsonLdMatches) {
    try {
      const data = JSON.parse(m[1]);
      if (data['@type'] === 'ProductGroup' || data['@type'] === 'Product') {
        console.log(url);
        const variants = data.hasVariant || (data.offers ? [data] : []);
        for (const v of variants) {
          const offer = v.offers || v;
          console.log(`  Variant: ${v.name || v.sku} | Price: ${offer.price} | Availability: ${offer.availability}`);
        }
      }
    } catch {}
  }
}

async function main() {
  await test('gmo-auto-420-fast-buds');
  await test('banana-frost-auto-420-fast-buds');
  await test('zangria-s1-wizard-trees');
}

main();
