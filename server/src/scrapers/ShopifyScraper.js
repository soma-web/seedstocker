import { BaseScraper } from './BaseScraper.js';

export class ShopifyScraper extends BaseScraper {
  constructor(shopName, logMessage, scrapeMode = 'price') {
    super(shopName, logMessage, scrapeMode);
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
                         
        const rawBreeder = p.vendor || 'Unknown';
        const breeder = this.normalizeBreeder(rawBreeder);

        if (breeder.toLowerCase() === 'headshop' || rawBreeder.toLowerCase() === 'headshop' || this.isInvalidStrainName(p.title, p.body_html, breeder)) {
          continue;
        }

        if (!isSeed || productType === 'displays' || tagsString.includes('pos-only') || tagsString.includes('pos only') || tagsString.includes('wholesale-only')) {
          continue;
        }
        
        if (limit !== null && scrapedCount >= limit) {
          this.log('info', `Scraped limit of ${limit} strains for ${this.shopName}. Stopping scan.`);
          hasMore = false;
          break;
        }
        scrapedCount++;
        
        scraperStatus.currentProduct = p.title;
        
        const name = this.normalizeStrainName(p.title, breeder);
        
        const type = this.determineStrainType(p.title, tagsString + ' ' + bodyHtml);
        
        let seedType = 'feminized';
        if (tagsString.includes('regular') || tagsString.includes('regulär') || 
            titleLower.includes('regular') || titleLower.includes('regulär')) {
          seedType = 'regular';
        }
        
        const specs = this.parseShopifySpecs(p.body_html, p.tags || []);
        let thc = specs.thc;
        let cbd = specs.cbd;
        let strainType = specs.strainType;
        let floweringTime = specs.floweringTime;
        let genetics = specs.genetics || null;

        const productUrl = `${baseUrl}/products/${p.handle}`;

        if (this.scrapeMode === 'metadata') {
          this.log('info', `Fetching full HTML DOM for product metadata: ${productUrl}`);
          const extraSpecs = await this.fetchMetafieldsFromHtml(productUrl);
          if (extraSpecs.thc) {
            this.log('info', `Successfully extracted THC from DOM for ${name}: ${extraSpecs.thc}`);
            thc = extraSpecs.thc;
          }
          if (extraSpecs.cbd) {
            this.log('info', `Successfully extracted CBD from DOM for ${name}: ${extraSpecs.cbd}`);
            cbd = extraSpecs.cbd;
          }
          if (extraSpecs.strainType) strainType = extraSpecs.strainType;
          if (extraSpecs.floweringTime) {
            this.log('info', `Successfully extracted Flowering Time from DOM for ${name}: ${extraSpecs.floweringTime} weeks`);
            floweringTime = extraSpecs.floweringTime;
          }
          if (extraSpecs.genetics) {
            this.log('info', `Successfully extracted Genetics from DOM for ${name}: ${extraSpecs.genetics}`);
            genetics = extraSpecs.genetics;
          }
        }

        let strainId;
        try {
          strainId = await this.upsertStrain({
            name,
            breeder,
            type,
            seedType,
            thc,
            cbd,
            strainType,
            floweringTime,
            description: p.body_html || '',
            genetics,
            url: `${baseUrl}/products/${p.handle}`,
            rawTitle: p.title
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
      res = await this.fetchWithRetry(url, {
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
        if (parsed['@type'] === 'Product' || parsed['@type'] === 'ProductGroup') {
          productSchema = parsed;
          break;
        } else if (parsed['@context']?.includes('schema.org') && parsed.name && (parsed.offers || parsed.variants || parsed.hasVariant || parsed.brand)) {
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

    const type = this.determineStrainType(title, html);

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
    const specs = this.parseShopifySpecs(html, tags);
    let thc = specs.thc;
    let cbd = specs.cbd;
    let strainType = specs.strainType;
    let floweringTime = specs.floweringTime;
    let genetics = specs.genetics || null;

    if (this.scrapeMode === 'metadata') {
      const extraSpecs = this.parseMetafieldsFromHtml(html);
      if (extraSpecs.thc) {
        this.log('info', `Successfully extracted THC from DOM for ${name}: ${extraSpecs.thc}`);
        thc = extraSpecs.thc;
      }
      if (extraSpecs.cbd) {
        this.log('info', `Successfully extracted CBD from DOM for ${name}: ${extraSpecs.cbd}`);
        cbd = extraSpecs.cbd;
      }
      if (extraSpecs.strainType) strainType = extraSpecs.strainType;
      if (extraSpecs.floweringTime) {
        this.log('info', `Successfully extracted Flowering Time from DOM for ${name}: ${extraSpecs.floweringTime} weeks`);
        floweringTime = extraSpecs.floweringTime;
      }
      if (extraSpecs.genetics) {
        this.log('info', `Successfully extracted Genetics from DOM for ${name}: ${extraSpecs.genetics}`);
        genetics = extraSpecs.genetics;
      }
    }

    const strainId = await this.upsertStrain({
      name,
      breeder,
      type,
      seedType,
      thc,
      cbd,
      strainType,
      floweringTime,
      description,
      genetics
    });
    let offersCreated = 0;

    let offersList = productSchema.offers?.offers || productSchema.offers || [];
    if (productSchema['@type'] === 'ProductGroup' && Array.isArray(productSchema.hasVariant)) {
      offersList = productSchema.hasVariant.map(v => ({
        name: v.name,
        price: v.offers?.price,
        availability: v.offers?.availability,
        url: v.offers?.url
      }));
    }
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
          url: o.url || url,
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

  parseMetafieldsFromHtml(html) {
    const specs = {};

    // ── THC ──────────────────────────────────────────────────────────────────
    // Matches: "25% THC", ">25% THC", "Potenz: ... 25%"
    const thcMatch = html.match(/([>≥]?\s*\d+(?:[.,]\d+)?\s*%)\s*THC/i)
                  || html.match(/THC[:\s]*([>≥]?\s*\d+(?:[.,]\d+)?\s*%)/i)
                  || html.match(/Potenz[^<\n]{0,50}?(\d+(?:[.,]\d+)?\s*%)/i);
    if (thcMatch) {
      specs.thc = thcMatch[1].trim().replace(/\s+/g, '');
    }

    // ── CBD ──────────────────────────────────────────────────────────────────
    // Matches: "0.2% CBD", "CBD: 1%"
    const cbdMatch = html.match(/(\d+(?:[.,]\d+)?\s*%)\s*CBD/i)
                  || html.match(/CBD[:\s]*(\d+(?:[.,]\d+)?\s*%)/i);
    if (cbdMatch) {
      specs.cbd = cbdMatch[1].trim().replace(/\s+/g, '');
    }

    // ── Blütezeit / Flowering Time ────────────────────────────────────────────
    // Matches: "8–9 Wochen", "8-9 Wochen", "56 Wochen" (then convert to weeks)
    const flowerMatch = html.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:Wochen|weeks)/i)
                     || html.match(/(\d+)\s*(?:Wochen|weeks)/i);
    if (flowerMatch) {
      if (flowerMatch[2]) {
        // Range: "8–9 Wochen" → store as "8-9"
        specs.floweringTime = `${flowerMatch[1]}-${flowerMatch[2]}`;
      } else {
        specs.floweringTime = flowerMatch[1];
      }
    }

    // ── Genetics / Cross Name ─────────────────────────────────────────────────
    // Priority 1: Meta description tag — "✓Genetik: X × Y ✓Feminisiert"
    const metaDescMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)
                       || html.match(/<meta[^>]*content="([^"]+)"[^>]*name="description"/i);
    if (metaDescMatch) {
      const genetikInMeta = metaDescMatch[1].match(/Genetik[:\s]+([^✓✔\n,]{3,80})/i);
      if (genetikInMeta) specs.genetics = genetikInMeta[1].trim();
    }
    // Priority 2: <dt>Kreuzung</dt> or "Breeder & Kreuzung" <dd> block
    if (!specs.genetics) {
      // DL block: <dt>Breeder & Kreuzung</dt><dd>Wizard Trees - 11:11 × Zangria</dd>
      const kreuzungMatch = html.match(/<dt[^>]*>[^<]*[Kk]reuzung[^<]*<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/i)
                         || html.match(/Breeder[^<]*?Kreuzung[^<]*?<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/i);
      if (kreuzungMatch) {
        // "Wizard Trees - 11:11 × Zangria" → take the part after " - "
        const parts = kreuzungMatch[1].split(/\s*[-–]\s*/);
        specs.genetics = (parts.length > 1 ? parts.slice(1).join(' - ') : parts[0]).trim();
      }
    }

    // ── Strain Type ───────────────────────────────────────────────────────────
    // Look for explicit strain type keywords in spec tables/labels, not random text
    // Only match when preceded by a label keyword to avoid false positives
    const strainTypeMatch = html.match(/(?:Sortentyp|Typ|Genetik|genetics)[^<\n]{0,30}?\b(Hybrid|Indica|Sativa|Indica-dominiert|Sativa-dominiert|indica-dominant|sativa-dominant)\b/i)
                         || html.match(/<dt[^>]*>[^<]*(?:Typ|Type)[^<]*<\/dt>\s*<dd[^>]*>([^<]*(?:Hybrid|Indica|Sativa)[^<]*)<\/dd>/i);
    if (strainTypeMatch) {
      const raw = (strainTypeMatch[1] || strainTypeMatch[0]).toLowerCase().trim();
      if (raw.includes('indica') && raw.includes('sativa')) specs.strainType = 'hybrid';
      else if (raw.includes('indica')) specs.strainType = 'indica';
      else if (raw.includes('sativa')) specs.strainType = 'sativa';
      else if (raw.includes('hybrid')) specs.strainType = 'hybrid';
    }

    return specs;
  }

  async fetchMetafieldsFromHtml(productUrl) {
    try {
      const res = await this.fetchWithRetry(productUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) return {};
      const html = await res.text();
      return this.parseMetafieldsFromHtml(html);
    } catch (err) {
      this.log('error', `Failed to fetch extra metafields from HTML at ${productUrl}: ${err.message}`);
      return {};
    }
  }
}
