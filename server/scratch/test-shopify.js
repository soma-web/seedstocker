import fs from 'node:fs';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function run() {
  const url = 'https://hansbrainfood.de/products.json?limit=250';
  console.log('Fetching', url);
  const res = await fetch(url, { headers });
  const data = await res.json();
  
  let count = 0;
  data.products.forEach((p) => {
    const productType = (p.product_type || '').toLowerCase();
    const tagsString = p.tags ? p.tags.join(' ').toLowerCase() : '';
    const bodyHtml = p.body_html ? p.body_html.toLowerCase() : '';
    const titleLower = p.title.toLowerCase();
    
    const isSeed = productType === 'cannabissamen' || 
                   productType === 'sämlinge' || 
                   tagsString.includes('samen') || 
                   tagsString.includes('seeds') ||
                   tagsString.includes('sämling') ||
                   titleLower.includes('samen') ||
                   titleLower.includes('seeds') ||
                   titleLower.includes('sämling');
                      
    if (isSeed) {
      count++;
      if (count <= 5) {
        console.log(`\n================ Cannabis Product ${count}: ${p.title} ================`);
        console.log('Product Type:', p.product_type);
        console.log('Tags:', p.tags);
        console.log('Body HTML:\n', p.body_html);
      }
    }
  });
  console.log(`\nTotal Cannabis Products found: ${count}`);
}

run();
