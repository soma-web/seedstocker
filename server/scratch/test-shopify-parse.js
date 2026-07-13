import fs from 'node:fs';

const html = fs.readFileSync('server/scratch/hans-page.html', 'utf8');

const jsonScriptsRe = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
let m;
let count = 0;
while ((m = jsonScriptsRe.exec(html)) !== null) {
  count++;
  try {
    const parsed = JSON.parse(m[1]);
    if (parsed && parsed.id && (parsed.title || parsed.name) && parsed.variants) {
      console.log('Found product JSON in script tag!');
      console.log('Title:', parsed.title || parsed.name);
      console.log('Vendor:', parsed.vendor || parsed.brand?.name);
      console.log('Description length:', (parsed.description || parsed.body_html || '').length);
      console.log('Tags:', parsed.tags);
    }
  } catch {}
}
