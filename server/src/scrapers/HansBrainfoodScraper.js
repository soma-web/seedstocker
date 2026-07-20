import { ShopifyScraper } from './ShopifyScraper.js';

export class HansBrainfoodScraper extends ShopifyScraper {
  constructor(logMessage, scrapeMode = 'price') {
    super('Hans Brainfood', logMessage, scrapeMode);
  }

  isInvalidStrainName(title, description = '') {
    if (!title) return true;
    const lower = title.toLowerCase();
    if (
      lower.includes('ungeschält') ||
      lower.includes('geschält') ||
      lower.includes('vorratspackung') ||
      lower.includes('bio ungeschält')
    ) {
      return true;
    }
    return super.isInvalidStrainName(title, description);
  }

  normalizeStrainName(title, breeder) {
    let cleanTitle = title.replace(/\bpremium\s+us\b/gi, '').replace(/\bpremium\b/gi, '').trim();
    cleanTitle = cleanTitle.replace(/^[\s\-_,.]+/, '').replace(/[\s\-_,.()]+$/, '').trim();

    let name = cleanTitle;
    if (cleanTitle.toLowerCase().includes('187') || (breeder && breeder.toLowerCase().includes('187'))) {
      const parts = cleanTitle.split(/\s*-\s*/);
      if (parts.length > 1) {
        let candidate = parts[1].trim();
        const stripKeywords = [
          'feminisiert', 'feminisierte', 'feminised', 'feminized', 'feminize', 'fem',
          'autoflowering', 'autoflower', 'automatic', 'auto',
          'regulär', 'regular', 'reg',
          'blitzversand', 'premium us', 'premium',
          'hanfsamen', 'cannabis', 'cannabis seeds', 'cannabissamen', 'seeds', 'samen',
          'f1 hybrid', 'f1'
        ];
        for (const kw of stripKeywords) {
          const kwRe = new RegExp(`\\b${kw}\\b`, 'gi');
          candidate = candidate.replace(kwRe, '');
        }
        candidate = candidate.replace(/^[\s\-_,.]+/, '').replace(/[\s\-_,.()]+$/, '').trim();
        if (candidate) {
          name = candidate;
        }
      }
    } else {
      name = super.normalizeStrainName(cleanTitle, breeder);
    }
    
    // Strip any parenthesized content (closed or unclosed)
    name = name.replace(/\(.*?\)/g, '').replace(/\(.*/g, '').trim();
    return name;
  }

  async scrape(scraperStatus, targetUrl) {
    this.log('info', `Starting ${this.shopName} scraper...`);
    scraperStatus.currentShop = this.shopName;
    
    if (!targetUrl) {
      this.log('error', `No URL configured for ${this.shopName}. Skipping.`);
      return;
    }

    let baseUrl = targetUrl.replace(/\/products\.json$/, '').replace(/\/$/, '');
    const productsJsonUrl = `${baseUrl}/products.json`;
    
    const limit = this.getLimit();
    let page = 1;
    let hasMore = true;
    let scrapedCount = 0;
    
    while (hasMore) {
      const url = `${productsJsonUrl}?limit=250&page=${page}`;
      this.log('info', `Fetching ${this.shopName} page ${page} from url: ${url}...`);
      
      let res;
      try {
        res = await this.fetchWithRetry(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
      } catch (err) {
        this.log('error', `Failed to fetch page ${page}: ${err.message}`);
        break;
      }
      
      if (!res.ok) {
        this.log('error', `Shop returned status ${res.status} for page ${page}`);
        break;
      }
      
      const data = await res.json();
      const products = data.products || [];
      
      if (products.length === 0) {
        this.log('info', `No more products found. Crawling complete.`);
        hasMore = false;
        break;
      }
      
      this.log('info', `Found ${products.length} products on page ${page}`);
      
      for (const p of products) {
        const handle = (p.handle || '').toLowerCase();
        if (!handle.includes('hanfsamen-')) {
          continue;
        }

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
                         
        if (!isSeed || productType === 'displays' || tagsString.includes('pos-only') || tagsString.includes('pos only') || tagsString.includes('wholesale-only') || this.isInvalidStrainName(p.title, p.body_html)) {
          this.log('info', `Skipping non-strain or faulty product "${p.title}"`);
          continue;
        }
        
        if (limit !== null && scrapedCount >= limit) {
          this.log('info', `Scraped limit of ${limit} strains for ${this.shopName}. Stopping scan.`);
          hasMore = false;
          break;
        }
        scrapedCount++;
        
        scraperStatus.currentProduct = p.title;
        
        const rawBreeder = p.vendor || 'Unknown';
        const breeder = this.normalizeBreeder(rawBreeder);
        const name = this.normalizeStrainName(p.title, breeder);
        
        let type = 'photoperiodic';
        if (tagsString.includes('autoflower') || tagsString.includes('auto') || 
            titleLower.includes('auto') || bodyHtml.includes('auto')) {
          type = 'autoflower';
        }
        
        let seedType = 'feminized';
        if (tagsString.includes('regular') || tagsString.includes('regulär') || 
            titleLower.includes('regular') || titleLower.includes('regulär')) {
          seedType = 'regular';
        }
        
        const specs = this.parseShopifySpecs(p.body_html, p.tags || []);
        let strainId;
        try {
          strainId = await this.upsertStrain({
            name,
            breeder,
            type,
            seedType,
            thc: specs.thc,
            cbd: specs.cbd,
            strainType: specs.strainType,
            floweringTime: specs.floweringTime
          });
        } catch (dbErr) {
          this.log('error', `Database error for strain ${name}: ${dbErr.message}`);
          continue;
        }
        
        const variants = p.variants || [];
        for (const v of variants) {
          let seeds = this.parseSeedCount(v.title) || this.parseSeedCount(v.sku) || 1;
          const price = parseFloat(v.price);
          const productUrl = `${baseUrl}/products/${p.handle}`;
          
          let availability = 'available';
          if (v.available === false) {
            availability = 'out_of_stock';
          } else if (v.inventory_quantity !== undefined && v.inventory_quantity <= 0 && v.inventory_policy === 'continue') {
            availability = 'orderable';
          }
          
          if (!isNaN(price)) {
            try {
              await this.insertOffer({ strainId, url: productUrl, seeds, price, availability });
              scraperStatus.productsScraped++;
            } catch (dbErr) {
              this.log('error', `Database error for offer of strain ${name}: ${dbErr.message}`);
            }
          }
        }
      }
      
      page++;
      await this.sleep(300);
    }
  }
}
