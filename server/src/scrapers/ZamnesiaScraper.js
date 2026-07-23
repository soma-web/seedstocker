import { BaseScraper } from './BaseScraper.js';

export class ZamnesiaScraper extends BaseScraper {
  constructor(logMessage, scrapeMode = 'price') {
    super('Zamnesia', logMessage, scrapeMode);
  }

  parseArgs(argsStr) {
    const args = [];
    let current = '';
    let inParens = 0;
    let inQuotes = false;
    let quoteChar = null;
    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];
      if (inQuotes) {
        if (char === quoteChar && argsStr[i-1] !== '\\') {
          inQuotes = false;
        }
        current += char;
      } else if (char === "'" || char === '"') {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (char === '(' || char === '[') {
        inParens++;
        current += char;
      } else if (char === ')' || char === ']') {
        inParens--;
        current += char;
      } else if (char === ',' && inParens === 0) {
        args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current) {
      args.push(current.trim());
    }
    return args;
  }

  async scrape(scraperStatus, targetUrl) {
    this.log('info', 'Starting Zamnesia scraper...');
    scraperStatus.currentShop = this.shopName;
    

    let categories = [
      { url: 'https://www.zamnesia.de/35-cannabissamen/295-feminisiert-hanfsamen', type: 'photoperiodic', seedType: 'feminized' },
      { url: 'https://www.zamnesia.de/35-cannabissamen/294-autoflowering-hanfsamen', type: 'autoflower', seedType: 'feminized' },
      { url: 'https://www.zamnesia.de/35-cannabissamen/296-regulare-hanfsamen', type: 'photoperiodic', seedType: 'regular' },
      { url: 'https://www.zamnesia.de/35-cannabissamen/634-f1-samen', type: 'autoflower', seedType: 'feminized' }
    ];

    if (targetUrl) {
      const urls = targetUrl.split(',').map(u => u.trim()).filter(Boolean);
      categories = urls.map(u => {
        let type = 'photoperiodic';
        let seedType = 'feminized';
        const lower = u.toLowerCase();
        if (lower.includes('autoflowering') || lower.includes('auto') || lower.includes('f1-samen') || lower.includes('f1')) {
          type = 'autoflower';
        }
        if (lower.includes('regulare') || lower.includes('regular') || lower.includes('regulär')) {
          seedType = 'regular';
        }
        return { url: u, type, seedType };
      });
    }
    
    const productPageUrls = new Set();
    const limit = this.getLimit();
    
    for (const cat of categories) {
      if (limit !== null && productPageUrls.size >= limit) {
        break;
      }
      this.log('info', `Crawling category index: ${cat.url}`);
      let page = 1;
      let keepCrawlingCat = true;
      
      while (keepCrawlingCat) {
        if (limit !== null && productPageUrls.size >= limit) {
          keepCrawlingCat = false;
          break;
        }
        const pageUrl = `${cat.url}?p=${page}`;
        this.log('info', `Fetching category page: ${pageUrl}`);
        
        let res;
        try {
          res = await this.fetchWithRetry(pageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
            }
          });
        } catch (err) {
          this.log('error', `Failed to fetch category page ${pageUrl}: ${err.message}`);
          break;
        }
        
        if (!res.ok) {
          this.log('warning', `Category returned non-200 code ${res.status}`);
          break;
        }
        
        const html = await res.text();
        
        const pageProductUrls = [];
        const re1 = /<a\b[^>]*?class=["'][^"']*?product_link[^"']*?["'][^>]*?href=["'](https:\/\/www\.zamnesia\.de\/\d+-[^"']+\.html)["']/gi;
        const re2 = /<a\b[^>]*?href=["'](https:\/\/www\.zamnesia\.de\/\d+-[^"']+\.html)["'][^>]*?class=["'][^"']*?product_link[^"']*?["']/gi;
        
        let match;
        while ((match = re1.exec(html)) !== null) {
          pageProductUrls.push(match[1]);
        }
        while ((match = re2.exec(html)) !== null) {
          pageProductUrls.push(match[1]);
        }
        
        const uniquePageUrls = [...new Set(pageProductUrls)];
        
        if (uniquePageUrls.length === 0) {
          this.log('info', `Reached end of category ${cat.url} at page ${page}`);
          keepCrawlingCat = false;
          break;
        }
        
        this.log('info', `Found ${uniquePageUrls.length} product links on category page ${page}`);
        
        for (const url of uniquePageUrls) {
          if (url.includes('mystery-box') || url.includes('headshop') || url.includes('vaporizer')) {
            continue;
          }
          productPageUrls.add(JSON.stringify({ url, type: cat.type, seedType: cat.seedType }));
          if (limit !== null && productPageUrls.size >= limit) {
            break;
          }
        }
        
        page++;
        await this.sleep(300);
        
        if (page > 8) {
          this.log('info', `Safety limit reached for category ${cat.url}. Stopping index fetch.`);
          keepCrawlingCat = false;
        }
      }
    }
    
    const productListToScrape = limit !== null
      ? Array.from(productPageUrls).map(s => JSON.parse(s)).slice(0, limit)
      : Array.from(productPageUrls).map(s => JSON.parse(s));
    this.log('info', `Total unique product pages queued for Zamnesia: ${productListToScrape.length}`);
    
    for (const item of productListToScrape) {
      const { url, type, seedType } = item;
      this.log('info', `Scraping Zamnesia page: ${url}`);
      
      let res;
      try {
        res = await this.fetchWithRetry(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
          }
        });
      } catch (err) {
        this.log('error', `Failed fetching page ${url}: ${err.message}`);
        await this.sleep(500);
        continue;
      }
      
      if (!res.ok) {
        this.log('warning', `Failed scraping page ${url} status ${res.status}`);
        await this.sleep(500);
        continue;
      }
      
      const html = await res.text();
      
      const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (!h1Match) {
        this.log('warning', `Could not find H1 title on page ${url}`);
        await this.sleep(500);
        continue;
      }
      const rawTitle = h1Match[1].trim();
      if (this.isInvalidStrainName(rawTitle, html)) {
        this.log('info', `Skipping invalid/collection strain: ${rawTitle}`);
        await this.sleep(500);
        continue;
      }
      scraperStatus.currentProduct = rawTitle;
      
      let rawBreeder = null;
      try {
        const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
        let jsonLdMatch;
        while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
          try {
            const data = JSON.parse(jsonLdMatch[1]);
            if (data && data['@type'] === 'Product') {
              if (data.brand) {
                if (typeof data.brand === 'string') {
                  rawBreeder = data.brand;
                } else if (data.brand.name) {
                  rawBreeder = data.brand.name;
                }
              }
            }
          } catch {}
        }
      } catch {}
  
      if (!rawBreeder) {
        const titleParenMatch = rawTitle.match(/\(([^)]+)\)/);
        if (titleParenMatch && titleParenMatch[1]) {
          rawBreeder = titleParenMatch[1].trim();
        }
      }
  
      if (!rawBreeder) {
        rawBreeder = 'Zamnesia Seeds';
      }
  
      const breeder = this.normalizeBreeder(rawBreeder);
      const name = this.normalizeStrainName(rawTitle, breeder);
      
      const addCombinationRegex = /addCombination\s*\(\s*(.*?)\s*\)\s*;/g;
      let match;
      const psCombinations = [];
      while ((match = addCombinationRegex.exec(html)) !== null) {
        const argsStr = match[1];
        const args = this.parseArgs(argsStr);
        if (args.length >= 11) {
          const comboId = args[0];
          const attrIdsMatch = args[1].match(/new Array\((.*?)\)/i) || args[1].match(/\[(.*?)\]/);
          const attrIds = attrIdsMatch 
            ? attrIdsMatch[1].replace(/'/g, '').replace(/"/g, '').split(',').map(s => s.trim()).filter(Boolean)
            : [];
          const price = parseFloat(args[10]);
          const qty = parseInt(args[2], 10);
          const availability = qty > 0 ? 'available' : 'out_of_stock';
          psCombinations.push({ comboId, attrIds, price, availability });
        }
      }
      
      const attrLabelMap = {};
      const optRe = /<option\b[^>]*value="(\d+)"[^>]*(?:title="([^"]*)")?[^>]*>([^<]*)<\/option>/gi;
      let optM;
      while ((optM = optRe.exec(html)) !== null) {
        const attrId = optM[1];
        const titleLabel = (optM[2] || '').trim();
        const innerLabel = (optM[3] || '').trim();
        const label = titleLabel || innerLabel;
        if (label) attrLabelMap[attrId] = label;
      }
      
      if (psCombinations.length === 0) {
        const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
        let jsonLdMatch;
        let singlePrice = null;
        let singleAvailability = 'available';
        while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
          try {
            const data = JSON.parse(jsonLdMatch[1]);
            if (data['@type'] === 'Product' && data.offers && data.offers.price) {
              singlePrice = parseFloat(data.offers.price);
              if (data.offers.availability) {
                const av = String(data.offers.availability).toLowerCase();
                if (av.includes('outofstock')) {
                  singleAvailability = 'out_of_stock';
                } else if (av.includes('preorder') || av.includes('backorder')) {
                  singleAvailability = 'orderable';
                }
              }
            }
          } catch {}
        }
        if (singlePrice && !isNaN(singlePrice)) {
          psCombinations.push({ comboId: 'single', attrIds: [], price: singlePrice, availability: singleAvailability });
        }
      }
      
      if (psCombinations.length === 0) {
        this.log('warning', `No combination offers found for ${name} at ${url}`);
        await this.sleep(500);
        continue;
      }
      
      const thcRaw = this.extractSpec(html, 'THC');
      const cbdRaw = this.extractSpec(html, 'CBD');
      const geneticsRaw = this.extractSpec(html, '(?:Genetik|Genetics)');
      const floweringRaw = this.extractSpec(html, '(?:Bl&uuml;tezeit|Blutezeit|Flowering\\s+Time)\\s*');

      const thc = this.cleanThc(thcRaw);
      const cbd = this.cleanCbd(cbdRaw);
      const floweringTime = this.cleanFloweringTime(floweringRaw);
      const strainType = this.normalizeStrainType(geneticsRaw);

      const description = this.extractDescription(html);
      let strainId;
      try {
        strainId = await this.upsertStrain({ name, breeder, type, seedType, thc, cbd, strainType, floweringTime, description, url, rawTitle: title || name });
      } catch (dbErr) {
        this.log('error', `Database error for Zamnesia strain ${name}: ${dbErr.message}`);
        await this.sleep(500);
        continue;
      }
      
      for (const combo of psCombinations) {
        const labels = combo.attrIds.map(id => attrLabelMap[id] || '').join(' ');
        const seeds = this.parseSeedCount(labels) || this.parseSeedCount(combo.attrIds.map(id => attrLabelMap[id] || id).join(' ')) || 1;
        const price = combo.price;
        const availability = combo.availability || 'available';
        
        try {
          await this.insertOffer({ strainId, url, seeds, price, availability });
          scraperStatus.productsScraped++;
        } catch (dbErr) {
          this.log('error', `Database error for Zamnesia offer of ${name}: ${dbErr.message}`);
        }
      }
      
      await this.sleep(500);
    }
  }

  async scrapeSingle(url) {
    const res = await this.fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Zamnesia page (status ${res.status})`);
    }
    
    const html = await res.text();
    
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (!h1Match) {
      throw new Error('Could not parse strain title from Zamnesia page.');
    }
    const rawTitle = h1Match[1].trim();
    if (this.isInvalidStrainName(rawTitle, html)) {
      throw new Error(`Skipping invalid/collection strain: ${rawTitle}`);
    }
    
    let type = 'photoperiodic';
    if (rawTitle.toLowerCase().includes('auto') || html.toLowerCase().includes('autoflowering') || html.toLowerCase().includes('automatisch')) {
      type = 'autoflower';
    }
    let seedType = 'feminized';
    if (rawTitle.toLowerCase().includes('regulär') || rawTitle.toLowerCase().includes('regular') || html.toLowerCase().includes('reguläre')) {
      seedType = 'regular';
    }
    
    let rawBreeder = null;
    try {
      const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let jsonLdMatch;
      while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
        try {
          const data = JSON.parse(jsonLdMatch[1]);
          if (data && data['@type'] === 'Product') {
            if (data.brand) {
              if (typeof data.brand === 'string') {
                rawBreeder = data.brand;
              } else if (data.brand.name) {
                rawBreeder = data.brand.name;
              }
            }
          }
        } catch {}
      }
    } catch {}

    if (!rawBreeder) {
      const titleParenMatch = rawTitle.match(/\(([^)]+)\)/);
      if (titleParenMatch && titleParenMatch[1]) {
        rawBreeder = titleParenMatch[1].trim();
      }
    }

    if (!rawBreeder) {
      rawBreeder = 'Zamnesia Seeds';
    }

    const breeder = this.normalizeBreeder(rawBreeder);
    const name = this.normalizeStrainName(rawTitle, breeder);
    
    const addCombinationRegex = /addCombination\s*\(\s*(.*?)\s*\)\s*;/g;
    let match;
    const psCombinations = [];
    while ((match = addCombinationRegex.exec(html)) !== null) {
      const argsStr = match[1];
      const args = this.parseArgs(argsStr);
      if (args.length >= 11) {
        const comboId = args[0];
        const attrIdsMatch = args[1].match(/new Array\((.*?)\)/i) || args[1].match(/\[(.*?)\]/);
        const attrIds = attrIdsMatch 
          ? attrIdsMatch[1].replace(/'/g, '').replace(/"/g, '').split(',').map(s => s.trim()).filter(Boolean)
          : [];
        const price = parseFloat(args[10]);
        const qty = parseInt(args[2], 10);
        const availability = qty > 0 ? 'available' : 'out_of_stock';
        psCombinations.push({ comboId, attrIds, price, availability });
      }
    }
    
    const attrLabelMap = {};
    const optRe = /<option\b[^>]*value="(\d+)"[^>]*(?:title="([^"]*)")?[^>]*>([^<]*)<\/option>/gi;
    let optM;
    while ((optM = optRe.exec(html)) !== null) {
      const attrId = optM[1];
      const titleLabel = (optM[2] || '').trim();
      const innerLabel = (optM[3] || '').trim();
      const label = titleLabel || innerLabel;
      if (label) attrLabelMap[attrId] = label;
    }
    
    if (psCombinations.length === 0) {
      const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let jsonLdMatch;
      let singlePrice = null;
      let singleAvailability = 'available';
      while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
        try {
          const data = JSON.parse(jsonLdMatch[1]);
          if (data['@type'] === 'Product' && data.offers && data.offers.price) {
            singlePrice = parseFloat(data.offers.price);
            if (data.offers.availability) {
              const av = String(data.offers.availability).toLowerCase();
              if (av.includes('outofstock')) {
                singleAvailability = 'out_of_stock';
              } else if (av.includes('preorder') || av.includes('backorder')) {
                singleAvailability = 'orderable';
              }
            }
          }
        } catch {}
      }
      if (singlePrice && !isNaN(singlePrice)) {
        psCombinations.push({ comboId: 'single', attrIds: [], price: singlePrice, availability: singleAvailability });
      }
    }
    
    if (psCombinations.length === 0) {
      throw new Error(`No combinations/pricing offers found on page.`);
    }
    
    const thcRaw = this.extractSpec(html, 'THC');
    const cbdRaw = this.extractSpec(html, 'CBD');
    const geneticsRaw = this.extractSpec(html, '(?:Genetik|Genetics)');
    const floweringRaw = this.extractSpec(html, '(?:Bl&uuml;tezeit|Blutezeit|Flowering\\s+Time)\\s*');

    const thc = this.cleanThc(thcRaw);
    const cbd = this.cleanCbd(cbdRaw);
    const floweringTime = this.cleanFloweringTime(floweringRaw);
    const strainType = this.normalizeStrainType(geneticsRaw);

    const description = this.extractDescription(html);
    const strainId = await this.upsertStrain({ name, breeder, type, seedType, thc, cbd, strainType, floweringTime, description, url, rawTitle: title || name });
    
    let offersCreated = 0;
    for (const combo of psCombinations) {
      const labels = combo.attrIds.map(id => attrLabelMap[id] || '').join(' ');
      const seeds = this.parseSeedCount(labels) || this.parseSeedCount(combo.attrIds.map(id => attrLabelMap[id] || id).join(' ')) || 1;
      const price = combo.price;
      const availability = combo.availability || 'available';
      
      await this.insertOffer({ strainId, url, seeds, price, availability });
      offersCreated++;
    }
    
    return { name, breeder, type, seedType, offersCreated, shop: this.shopName };
  }

  extractDescription(html) {
    let description = null;
    try {
      const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let jsonLdMatch;
      while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
        try {
          const data = JSON.parse(jsonLdMatch[1]);
          if (data && data['@type'] === 'Product' && data.description) {
            description = data.description;
            break;
          }
        } catch {}
      }
    } catch {}

    if (!description) {
      const descMetaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i) ||
                           html.match(/<meta\s+property=["']og:description["']\s+content=["']([\s\S]*?)["']/i);
      if (descMetaMatch) {
        description = descMetaMatch[1];
      }
    }
    return description || '';
  }
}
