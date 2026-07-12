import { BaseScraper } from './BaseScraper.js';

export class HouseOfSeedsScraper extends BaseScraper {
  constructor(logMessage) {
    super('House of Seeds', logMessage);
  }

  async scrape(scraperStatus, targetUrl) {
    this.log('info', 'Starting House of Seeds scraper...');
    scraperStatus.currentShop = this.shopName;
    
    await this.clearOffers();
    
    const baseUrl = targetUrl || 'https://house-of-seeds.de/products.json';
    const limit = this.getLimit();
    let page = 1;
    let hasMore = true;
    let scrapedCount = 0;
    
    while (hasMore) {
      const separator = baseUrl.includes('?') ? '&' : '?';
      const url = `${baseUrl}${separator}limit=250&page=${page}`;
      this.log('info', `Fetching HOS page ${page} from url: ${url}...`);
      
      let res;
      try {
        res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
      } catch (err) {
        this.log('error', `Failed to fetch HOS page ${page}: ${err.message}`);
        break;
      }
      
      if (!res.ok) {
        this.log('error', `HOS returned status ${res.status} for page ${page}`);
        break;
      }
      
      const data = await res.json();
      const products = data.products || [];
      
      if (products.length === 0) {
        this.log('info', `No more products found. HOS crawling complete.`);
        hasMore = false;
        break;
      }
      
      this.log('info', `Found ${products.length} products on HOS page ${page}`);
      
      for (const p of products) {
        const productType = (p.product_type || '').toLowerCase();
        const tagsString = p.tags ? p.tags.join(' ').toLowerCase() : '';
        const bodyHtml = p.body_html ? p.body_html.toLowerCase() : '';
        const titleLower = p.title.toLowerCase();
        
        const isSeed = productType === 'cannabissamen' || 
                       tagsString.includes('samen') || 
                       tagsString.includes('seeds') ||
                       titleLower.includes('samen') ||
                       titleLower.includes('seeds');
                        
        if (!isSeed) {
          continue;
        }
        
        if (limit !== null && scrapedCount >= limit) {
          this.log('info', `Scraped limit of ${limit} strains for HOS. Stopping HOS scan.`);
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
        
        let strainId;
        try {
          strainId = await this.upsertStrain({ name, breeder, type, seedType });
        } catch (dbErr) {
          this.log('error', `Database error for strain ${name}: ${dbErr.message}`);
          continue;
        }
        
        const variants = p.variants || [];
        for (const v of variants) {
          const seeds = this.parseSeedCount(v.title) || this.parseSeedCount(v.sku) || 1;
          const price = parseFloat(v.price);
          const productUrl = `https://house-of-seeds.de/products/${p.handle}`;
          
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
      await this.sleep(500); // Shopify rate-limit respect
    }
  }

  async scrapeSingle(productUrl) {
    const match = productUrl.match(/\/products\/([a-zA-Z0-9\-_]+)/);
    if (!match) {
      throw new Error('Invalid House of Seeds product URL format.');
    }
    const handle = match[1];
    const jsonUrl = `https://house-of-seeds.de/products/${handle}.json`;
    
    const res = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch product details from House of Seeds (status ${res.status})`);
    }
    
    const data = await res.json();
    const p = data.product;
    if (!p) {
      throw new Error('No product data returned by House of Seeds API.');
    }

    const productType = (p.product_type || '').toLowerCase();
    const tagsString = p.tags ? p.tags.join(' ').toLowerCase() : '';
    const bodyHtml = p.body_html ? p.body_html.toLowerCase() : '';
    const titleLower = p.title.toLowerCase();
    
    const isSeed = productType === 'cannabissamen' || 
                   tagsString.includes('samen') || 
                   tagsString.includes('seeds') ||
                   titleLower.includes('samen') ||
                   titleLower.includes('seeds');
                    
    if (!isSeed) {
      throw new Error('The requested product does not appear to be a cannabis seed.');
    }
    
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
    
    const strainId = await this.upsertStrain({ name, breeder, type, seedType });
    
    const variants = p.variants || [];
    let offersCreated = 0;
    for (const v of variants) {
      const seeds = this.parseSeedCount(v.title) || this.parseSeedCount(v.sku) || 1;
      const price = parseFloat(v.price);
      const url = `https://house-of-seeds.de/products/${handle}`;
      
      let availability = 'available';
      if (v.available === false) {
        availability = 'out_of_stock';
      } else if (v.inventory_quantity !== undefined && v.inventory_quantity <= 0 && v.inventory_policy === 'continue') {
        availability = 'orderable';
      }

      if (!isNaN(price)) {
        await this.insertOffer({ strainId, url, seeds, price, availability });
        offersCreated++;
      }
    }
    return { name, breeder, type, seedType, offersCreated, shop: this.shopName };
  }
}
