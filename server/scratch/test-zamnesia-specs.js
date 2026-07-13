import fs from 'node:fs';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
};

function extractSpec(html, headerPattern) {
  const regex = new RegExp(`<th>\\s*${headerPattern}\\s*</th>\\s*<td>\\s*([\\s\\S]*?)\\s*</td>`, 'i');
  const match = html.match(regex);
  return match ? match[1].trim() : null;
}

function cleanThc(val) {
  if (!val) return null;
  const m = val.match(/(\d+(?:\.\d+)?\s*%\s*(?:-\s*\d+(?:\.\d+)?\s*%)?|\d+\s*-\s*\d+\s*%|\d+\s*%)/);
  if (m) return m[1].replace(/\s+/g, '').trim();
  const num = val.match(/(\d+(?:\.\d+)?)/);
  if (num) return num[1] + '%';
  return val.trim();
}

function cleanCbd(val) {
  if (!val) return null;
  const m = val.match(/(\d+(?:\.\d+)?\s*%\s*(?:-\s*\d+(?:\.\d+)?\s*%)?|\d+\s*-\s*\d+\s*%|\d+\s*%)/);
  if (m) return m[1].replace(/\s+/g, '').trim();
  const num = val.match(/(\d+(?:\.\d+)?)/);
  if (num) return num[1] + '%';
  return val.trim();
}

function cleanFloweringTime(val) {
  if (!val) return null;
  const m = val.match(/(\d+\s*-\s*\d+|\d+\s*–\s*\d+|\d+)/);
  if (m) {
    return m[1].replace(/\s+/g, '').trim();
  }
  return val.trim();
}

function normalizeStrainType(val, tags = []) {
  const typeTags = ['indica', 'sativa', 'hybrid', 'indica-dominant', 'sativa-dominant'];
  for (const tag of tags) {
    const tLower = tag.toLowerCase();
    if (typeTags.includes(tLower)) return tLower;
    if (tLower.includes('hybrid') || tLower.includes('hybride')) return 'hybrid';
  }
  if (!val) return null;
  const str = val.toLowerCase();
  
  const indicaMatch = str.match(/indica\s*(\d+)\s*%/i);
  const sativaMatch = str.match(/sativa\s*(\d+)\s*%/i);
  
  if (indicaMatch && sativaMatch) {
    const ind = parseInt(indicaMatch[1], 10);
    const sat = parseInt(sativaMatch[1], 10);
    if (ind > sat + 10) return 'indica-dominant';
    if (sat > ind + 10) return 'sativa-dominant';
    return 'hybrid';
  }
  
  if (str.includes('indica-dominant') || str.includes('indica dominant') || str.includes('indica-lastig')) return 'indica-dominant';
  if (str.includes('sativa-dominant') || str.includes('sativa dominant') || str.includes('sativa-lastig')) return 'sativa-dominant';
  if (str.includes('indica')) return 'indica';
  if (str.includes('sativa')) return 'sativa';
  if (str.includes('hybrid') || str.includes('hybride')) return 'hybrid';
  return null;
}

async function testUrl(url) {
  console.log('\nFetching', url);
  const res = await fetch(url, { headers });
  const html = await res.text();
  
  const thcRaw = extractSpec(html, 'THC');
  const cbdRaw = extractSpec(html, 'CBD');
  const geneticsRaw = extractSpec(html, '(?:Genetik|Genetics)');
  const floweringRaw = extractSpec(html, '(?:Bl&uuml;tezeit|Blutezeit|Flowering\\s+Time)\\s*');
  
  console.log('Raw Specs:', { thcRaw, cbdRaw, geneticsRaw, floweringRaw });
  console.log('Cleaned Specs:', {
    thc: cleanThc(thcRaw),
    cbd: cleanCbd(cbdRaw),
    flowering: cleanFloweringTime(floweringRaw),
    strainType: normalizeStrainType(geneticsRaw)
  });
}

async function run() {
  const urls = [
    'https://www.zamnesia.de/14927-zamnesia-seeds-gorilla-piss-fast-version.html',
    'https://www.zamnesia.de/14915-hash-burger-zamnesia-seeds-feminisiert.html'
  ];
  for (const url of urls) {
    await testUrl(url);
  }
}

run();
