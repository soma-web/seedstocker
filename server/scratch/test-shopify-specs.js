import fs from 'node:fs';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseSpecs(bodyHtml, tags) {
  const plainText = stripHtml(bodyHtml);
  
  // Let's print clean matches if we can target list items
  // e.g. <li>... <strong>Art:</strong>... Sativa 10 % / Indica 90 % ...</li>
  let thc = null;
  let cbd = null;
  let flowering = null;
  let strainType = null;

  // Let's use more precise regexes targeting list items or table rows
  const liMatches = bodyHtml.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
  liMatches.forEach(li => {
    const liText = stripHtml(li);
    if (/THC-Gehalt/i.test(liText) || /THC:/i.test(liText)) {
      const match = liText.match(/(?:THC-Gehalt|THC):?\s*(?:ca\.)?\s*([^.\n]+)/i);
      if (match) thc = match[1].trim();
    }
    if (/CBD/i.test(liText)) {
      const match = liText.match(/(?:CBD-Gehalt|CBD):?\s*(?:ca\.)?\s*([^.\n]+)/i);
      if (match) cbd = match[1].trim();
    }
    if (/Blütephase|Blütezeit|Blütendauer|Flowering/i.test(liText)) {
      const match = liText.match(/(?:Blütephase|Blütezeit|Blütendauer|Flowering|Flowering\s+Time):?\s*([^.\n]+)/i);
      if (match) flowering = match[1].trim();
    }
    if (/Art:|Typ:|Type:/i.test(liText)) {
      const match = liText.match(/(?:Art|Typ|Type):?\s*([^.\n]+)/i);
      if (match) strainType = match[1].trim();
    }
  });

  // Fallbacks using plain text regex if not found in list items
  if (!thc) {
    const match = plainText.match(/(?:THC-Gehalt|THC|Potenz):?\s*(?:ca\.)?\s*([0-9]+(?:\.[0-9]+)?\s*%\s*(?:-\s*[0-9]+(?:\.[0-9]+)?\s*%)?|[0-9]+\s*-\s*[0-9]+\s*%|[0-9]+\s*%)/i);
    if (match) thc = match[1].trim();
  }
  if (!cbd) {
    const match = plainText.match(/(?:CBD-Gehalt|CBD):?\s*(?:ca\.)?\s*([0-9]+(?:\.[0-9]+)?\s*%\s*(?:-\s*[0-9]+(?:\.[0-9]+)?\s*%)?|[0-9]+\s*-\s*[0-9]+\s*%|[0-9]+\s*%)/i);
    if (match) cbd = match[1].trim();
  }
  if (!flowering) {
    const match = plainText.match(/(?:Blütephase|Blütezeit|Blütendauer):?\s*([0-9]+(?:\s*-\s*[0-9]+)?\s*(?:Wochen|Weeks|Tage|Days)?)/i);
    if (match) flowering = match[1].trim();
  }

  // Check tags first as they are very clean
  const typeTags = ['indica', 'sativa', 'hybrid', 'indica-dominant', 'sativa-dominant'];
  for (const tag of tags) {
    const tLower = tag.toLowerCase();
    if (typeTags.includes(tLower)) {
      strainType = tag;
      break;
    }
  }

  // Handle Sativa/Indica-Hybride tag
  if (!strainType) {
    if (tags.some(t => /sativa\/indica-hybride/i.test(t) || /hybrid/i.test(t))) {
      strainType = 'Hybrid';
    }
  }

  return { thc, cbd, flowering, strainType };
}

async function run() {
  const url = 'https://hansbrainfood.de/products.json?limit=250';
  console.log('Fetching', url);
  const res = await fetch(url, { headers });
  const data = await res.json();
  
  let count = 0;
  for (const p of data.products) {
    const productType = (p.product_type || '').toLowerCase();
    const tagsString = p.tags ? p.tags.join(' ').toLowerCase() : '';
    const titleLower = p.title.toLowerCase();
    
    const isSeed = productType === 'cannabissamen' || 
                   productType === 'sämlinge' || 
                   tagsString.includes('samen') || 
                   tagsString.includes('seeds') ||
                   tagsString.includes('sämling') ||
                   titleLower.includes('samen') ||
                   titleLower.includes('seeds') ||
                   titleLower.includes('sämling');
                      
    if (isSeed && !productType.includes('display') && !tagsString.includes('pos-only')) {
      count++;
      if (count <= 15) {
        const specs = parseSpecs(p.body_html, p.tags);
        console.log(`\nStrain ${count}: ${p.title}`);
        console.log('  Tags:', p.tags);
        console.log('  Parsed Specs:', specs);
      }
    }
  }
}

run();
