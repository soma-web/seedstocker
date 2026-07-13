import { BaseScraper } from './BaseScraper.js';

export class ShopifyScraper extends BaseScraper {
  constructor(shopName, logMessage) {
    super(shopName, logMessage);
  }

  async scrape(scraperStatus, targetUrl) {
    this.log('info', `Starting ${this.shopName} scraper...`);
    scraperStatus.currentShop = this.shopName;
    
    await this.clearOffers();
    
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
        res = await fetch(url, {
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
                         
        if (!isSeed || productType === 'displays' || tagsString.includes('pos-only') || tagsString.includes('pos only') || tagsString.includes('wholesale-only') || this.isInvalidStrainName(p.title)) {
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

  async scrapeSingle(url) {
    this.log('info', `On-demand single page scrape starting for ${url}`);
    
    let res;
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
    } catch (err) {
      this.log('error', `Failed fetching single URL ${url}: ${err.message}`);
      return null;
    }

    if (!res.ok) {
      this.log('error', `Failed loading ${url}: status ${res.status}`);
      return null;
    }

    const html = await res.text();
    
    const productSchemaRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let productSchema = null;
    while ((match = productSchemaRegex.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed['@type'] === 'Product' || parsed['@context']?.includes('schema.org')) {
          productSchema = parsed;
          break;
        }
      } catch {}
    }

    if (!productSchema) {
      const windowProductRegex = /window\.Shopify\s*=\s*window\.Shopify\s*\|\|\s*\{\};\s*window\.Shopify\.Product\s*=\s*([\s\S]*?);/i;
      const productJsonMatch = html.match(windowProductRegex);
      if (productJsonMatch) {
        try {
          productSchema = JSON.parse(productJsonMatch[1]);
        } catch {}
      }
    }

    if (!productSchema) {
      const jsonScriptsRe = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let m;
      while ((m = jsonScriptsRe.exec(html)) !== null) {
        try {
          const parsed = JSON.parse(m[1]);
          if (parsed && parsed.id && (parsed.title || parsed.name) && parsed.variants) {
            productSchema = parsed;
            break;
          }
        } catch {}
      }
    }

    if (!productSchema) {
      this.log('error', `Could not parse Shopify product schema on single page: ${url}`);
      return null;
    }

    const title = productSchema.name || productSchema.title;
    if (this.isInvalidStrainName(title)) {
      this.log('warning', `Skipping single page scrape for invalid/collection strain: ${title}`);
      return null;
    }
    const vendor = productSchema.brand?.name || productSchema.vendor || 'Unknown';
    const breeder = this.normalizeBreeder(vendor);
    const name = this.normalizeStrainName(title, breeder);

    let type = 'photoperiodic';
    const titleLower = title.toLowerCase();
    if (titleLower.includes('auto')) {
      type = 'autoflower';
    }

    let seedType = 'feminized';
    if (titleLower.includes('regular') || titleLower.includes('regulär')) {
      seedType = 'regular';
    }

    const description = productSchema.description || productSchema.body_html || '';
    let tags = productSchema.tags || [];
    if (!Array.isArray(tags) || tags.length === 0) {
      const tagsRe = /"tags"\s*:\s*(\[[^\]]*\])/i;
      const m = html.match(tagsRe);
      if (m) {
        try { tags = JSON.parse(m[1]); } catch {}
      }
    }
    const specs = this.parseShopifySpecs(description, tags);

    const strainId = await this.upsertStrain({
      name,
      breeder,
      type,
      seedType,
      thc: specs.thc,
      cbd: specs.cbd,
      strainType: specs.strainType,
      floweringTime: specs.floweringTime
    });
    let offersCreated = 0;

    const offersList = productSchema.offers?.offers || productSchema.offers || [];
    const variants = productSchema.variants || [];

    if (Array.isArray(offersList) && offersList.length > 0) {
      for (const o of offersList) {
        const optTitle = o.name || o.title || '';
        const seeds = this.parseSeedCount(optTitle) || 1;
        const price = parseFloat(o.price);
        const availability = o.availability?.includes('InStock') ? 'available' : 'out_of_stock';

        await this.insertOffer({
          strainId,
          shop: this.shopName,
          url,
          seeds,
          price,
          availability
        });
        offersCreated++;
      }
    } else if (variants.length > 0) {
      for (const v of variants) {
        const seeds = this.parseSeedCount(v.title) || 1;
        const price = parseFloat(v.price);
        const availability = v.available ? 'available' : 'out_of_stock';

        await this.insertOffer({
          strainId,
          shop: this.shopName,
          url,
          seeds,
          price,
          availability
        });
        offersCreated++;
      }
    } else {
      const price = parseFloat(productSchema.offers?.price || productSchema.price);
      if (!isNaN(price)) {
        const availability = productSchema.offers?.availability?.includes('InStock') ? 'available' : 'out_of_stock';
        await this.insertOffer({
          strainId,
          shop: this.shopName,
          url,
          seeds: 1,
          price,
          availability
        });
        offersCreated++;
      }
    }

    return { name, breeder, shop: this.shopName, offersCreated };
  }
}
