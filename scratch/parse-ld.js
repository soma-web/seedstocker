import fs from 'node:fs';

const html = fs.readFileSync('./scratch/hos_page.html', 'utf8');
const jsonLdMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

for (const m of jsonLdMatches) {
  try {
    const data = JSON.parse(m[1]);
    if (data['@type'] === 'ProductGroup' || data['@type'] === 'Product') {
      console.log('Found product JSON-LD:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('JSON parse error:', err.message);
  }
}
