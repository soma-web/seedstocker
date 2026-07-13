import fs from 'node:fs';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
};

async function run() {
  const url = 'https://hansbrainfood.de/products/samling-black-runtz-fem-1';
  console.log('Fetching', url);
  const res = await fetch(url, { headers });
  const html = await res.text();
  fs.writeFileSync('server/scratch/hans-page.html', html, 'utf8');
  console.log('Saved hans-page.html');
}

run();
