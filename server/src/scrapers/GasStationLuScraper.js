import { ShopifyScraper } from './ShopifyScraper.js';
import { normalizeBreederName, KNOWN_BREEDERS } from './breeder-normalize.js';

export class GasStationLuScraper extends ShopifyScraper {
  constructor(logMessage, scrapeMode = 'price') {
    super('Gas Station LU', logMessage, scrapeMode);
  }

  normalizeBreeder(rawVendor, title = '') {
    let raw = rawVendor ? rawVendor.trim() : '';

    // Check if title or vendor has "BF" as a separate word (Barney's Farm)
    if (/\bBF\b/i.test(title) || /\bBF\b/i.test(raw)) {
      return "Barney's Farm";
    }

    // If vendor is missing or generic "Gas Station", try to find breeder in title
    if (!raw || raw.toLowerCase() === 'gas station' || raw.toLowerCase() === 'gas-station' || raw.toLowerCase() === 'unknown') {
      let titleBreeder = null;
      // 0. Look for breeder in square brackets at the beginning (e.g. "[Ripper Seeds] ...")
      const bracketMatch = title.match(/^\[([^\]]+)\]/);
      if (bracketMatch) {
        titleBreeder = bracketMatch[1].trim();
      } else {
        // 1. Look for "by <Breeder>"
        const byMatch = title.match(/\sby\s+([^|(\n]+)/i);
        if (byMatch) {
          titleBreeder = byMatch[1].trim();
        } else {
          // 2. Check dash delimiter ("Breeder - Strain" or "Strain - Breeder")
          const dashParts = title.split(/\s*[-–—]\s*/);
          if (dashParts.length > 1) {
            const firstClean = normalizeBreederName(dashParts[0].trim());
            if (firstClean && KNOWN_BREEDERS.has(firstClean.toLowerCase())) {
              return firstClean;
            }
            const lastClean = normalizeBreederName(dashParts[dashParts.length - 1].trim());
            if (lastClean && KNOWN_BREEDERS.has(lastClean.toLowerCase())) {
              return lastClean;
            }
          }

          // 3. Check pipe delimiter ("Strain | Breeder")
          const pipeMatch = title.match(/\s*\|\s*([^|(\n]+)/);
          if (pipeMatch) {
            titleBreeder = pipeMatch[1].trim();
          }
        }
      }
      raw = titleBreeder || 'Gas Station LU';
    }

    if (!raw) return 'Gas Station LU';

    // Intercept specific NineWeeksHarvest variations before calling general normalizer
    if (raw.toLowerCase().replace(/\s+/g, '') === 'nineweeksharvest') {
      return 'Nine Week Harvest';
    }

    const cleaned = normalizeBreederName(raw);
    return cleaned || 'Gas Station LU';
  }

  normalizeStrainName(title, breeder) {
    if (!title) return '';

    let name = title.trim();

    // Remove standalone "BF" and "US" words (e.g. "BF White Widow XXL" -> "White Widow XXL", "US Sour Diesel" -> "Sour Diesel")
    name = name.replace(/\b(BF|US)\b\s*/gi, '');

    // Remove square brackets and anything inside them (e.g. "[Ripper Seeds] Zombie Bride" -> "Zombie Bride")
    name = name.replace(/\[[^\]]*\]/g, '');

    // Remove promo packages (e.g. "7+1")
    name = name.replace(/\s*\b\d+\s*\+\s*\d+\b/g, '');

    // Remove "*Limited*" prefixes from the beginning of names
    name = name.replace(/^\*+limited\*+\s*/i, '');

    // 1. Remove promo suffixes (e.g. "| Gas-Station exclusive Mary Jane Drop", "- only available today...")
    name = name.replace(/\s*\|\s*Gas-Station exclusive.*$/i, '');
    name = name.replace(/\s*-\s*only available today.*$/i, '');
    name = name.replace(/\s*\|\s*.*Drop.*$/i, '');

    // 2. Remove seed count and pack extra info suffixes (e.g. "10 feminized seeds", "5 seeds", "8 seeds + 2 Papaya Dawg + 2 Peach Float", "8+ seeds FEMINIZED")
    name = name.replace(/\s+\d+\+?\s*(?:feminized|feminised|regular|regulär|autoflower|autoflowering)?\s*seeds(?:\s*\+\s*[^|\n]+)?/gi, '');
    name = name.replace(/\s+\d+\+?\s*seeds\s+FEMINIZED/gi, '');

    // 3. Remove parenthetical cross/lineage (e.g. "(Dr. Sleep x Frog Poison)", "((Z x Kush Mints) x Ultraviolet Sherb)")
    if (/\([^)]*[xX\u00d7]|reversal/i.test(name)) {
      let prev;
      do {
        prev = name;
        name = name.replace(/\s*\([^()]*\)/g, '');
      } while (name !== prev && /\(/.test(name));
    }

    // 4. Delegate to base ShopifyScraper for additional keyword cleaning
    let result = super.normalizeStrainName(name, breeder);
    result = result.replace(/[\s|]+$/, '').trim();

    // Special mapping for Gas Station LU: "22" -> "22 (Jack Herer x OG Kush )"
    if (result === '22') {
      return '22 (Jack Herer x OG Kush )';
    }

    return result || title.trim();
  }

  parseSeedCount(variantTitle, productTitle = '') {
    const isDefault = (str) => !str || typeof str !== 'string' || str.trim().toLowerCase() === 'default title' || str.trim() === '';

    const sanitizeTitle = (str) => {
      if (!str) return '';
      return str
        .replace(/#\d+/g, '')
        .replace(/\b\d+\s*[\u00d7xX]\s*/g, '');
    };

    if (!isDefault(variantTitle)) {
      const cleanV = variantTitle.trim();

      const promoMatch = cleanV.match(/^(\d+)\s*\+/);
      if (promoMatch) {
        const count = parseInt(promoMatch[1], 10);
        if (!isNaN(count) && count > 0) return count;
      }

      const sanitizedV = sanitizeTitle(cleanV);
      const explicitV = sanitizedV.match(/(\d+)\+?\s*(?:feminized|feminised|regular|regulär|autoflower|autoflowering)?\s*(?:seeds|samen|stk|stück|pack|pk)\b/i);
      if (explicitV) {
        const count = parseInt(explicitV[1], 10);
        if (!isNaN(count) && count > 0) return count;
      }

      const numV = cleanV.match(/^\s*(\d+)\s*(?:pack|pk|er|stk|stück|seeds|samen)?\s*$/i);
      if (numV) {
        const count = parseInt(numV[1], 10);
        if (!isNaN(count) && count > 0) return count;
      }

      const explicitFullV = sanitizedV.match(/(\d+)\+?\s*(?:feminized|feminised|regular|regulär|autoflower|autoflowering)?\s*seeds/i);
      if (explicitFullV) {
        const count = parseInt(explicitFullV[1], 10);
        if (!isNaN(count) && count > 0) return count;
      }
    }

    if (!isDefault(productTitle)) {
      const sanitizedP = sanitizeTitle(productTitle);
      const pMatch = sanitizedP.match(/(\d+)\+?\s*(?:feminized|feminised|regular|regulär|autoflower|autoflowering)?\s*seeds/i);
      if (pMatch) {
        const count = parseInt(pMatch[1], 10);
        if (!isNaN(count) && count > 0) return count;
      }
    }

    return 1;
  }

  extractSeedType(title = '', tags = [], bodyHtml = '') {
    const combined = `${title} ${(tags || []).join(' ')} ${bodyHtml}`.toLowerCase();

    if (/\bregular\b|\bregulär\b|\bregs\b/i.test(combined)) {
      return 'regular';
    }

    return 'feminized';
  }

  parseMetafieldsFromHtml(html) {
    const specs = super.parseMetafieldsFromHtml(html) || {};

    // ── Flowering Time for Gas Station LU (converting days or weeks) ──────────────
    if (!specs.floweringTime) {
      const dayMatch = html.match(/Flowering\s*Time[:\s]+(\d+)\s*[-–]\s*(\d+)\s*days/i)
                    || html.match(/Flowering\s*Time[:\s]+(\d+)\s*days/i);
      if (dayMatch) {
        if (dayMatch[2]) {
          const minW = Math.round(parseInt(dayMatch[1], 10) / 7);
          const maxW = Math.round(parseInt(dayMatch[2], 10) / 7);
          specs.floweringTime = `${minW}-${maxW}`;
        } else {
          specs.floweringTime = String(Math.round(parseInt(dayMatch[1], 10) / 7));
        }
      } else {
        const weekMatch = html.match(/FLOWERING\s*TIME[:\s]+(\d+)\s*Weeks/i);
        if (weekMatch) {
          specs.floweringTime = weekMatch[1];
        }
      }
    }

    // ── Strain Type / Ratio ───────────────────────────────────────────────────
    if (!specs.strainType) {
      const typeMatch = html.match(/Genetics[:\s]+(Hybrid|Indica|Sativa)/i)
                     || html.match(/\b(Indica|Sativa|Hybrid)\s*dominant\b/i);
      if (typeMatch) {
        const val = typeMatch[1].toLowerCase();
        if (val.includes('indica') && val.includes('sativa')) specs.strainType = 'hybrid';
        else if (val.includes('indica')) specs.strainType = 'indica';
        else if (val.includes('sativa')) specs.strainType = 'sativa';
        else if (val.includes('hybrid')) specs.strainType = 'hybrid';
      }
    }

    // ── Lineage ───────────────────────────────────────────────────────────────
    if (!specs.genetics) {
      const lineageMatch = html.match(/Lineage[:\s]+([^<\n|]+)/i)
                        || html.match(/Terpene\s*Profile[:\s]+([^<\n|]+)/i);
      if (lineageMatch) {
        specs.genetics = lineageMatch[1].trim();
      }
    }

    return specs;
  }

  // fetchWithRetry is inherited from BaseScraper — it handles 429 with proxy fallback.

  async fetchMetafieldsFromHtml(productUrl) {
    // 1.5s polite delay between individual product page HTML requests to avoid triggering HTTP 429
    await this.sleep(1500);

    try {
      const res = await this.fetchWithRetry(productUrl);
      if (!res || !res.ok) return {};
      const html = await res.text();
      return this.parseMetafieldsFromHtml(html);
    } catch (err) {
      this.log('error', `Failed to fetch extra metafields from HTML at ${productUrl}: ${err.message}`);
      return {};
    }
  }

  async scrape(scraperStatus, targetUrl) {
    this.log('info', `Starting ${this.shopName} scraper with rate-limit backoff protection...`);
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
        res = await this.fetchWithRetry(url);
      } catch (err) {
        this.log('error', `Failed to fetch page ${page}: ${err.message}`);
        break;
      }

      if (!res || !res.ok) {
        this.log('error', `Shop returned status ${res ? res.status : 'error'} for page ${page}`);
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
                       titleLower.includes('sämling') ||
                       p.title.length > 0; // gas-station.lu items are seeds

        const rawBreeder = p.vendor || 'Unknown';
        const breeder = this.normalizeBreeder(rawBreeder, p.title);

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

        let seedType = this.extractSeedType(p.title, p.tags, p.body_html);

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
          if (extraSpecs.thc) thc = extraSpecs.thc;
          if (extraSpecs.cbd) cbd = extraSpecs.cbd;
          if (extraSpecs.strainType) strainType = extraSpecs.strainType;
          if (extraSpecs.floweringTime) floweringTime = extraSpecs.floweringTime;
          if (extraSpecs.genetics) genetics = extraSpecs.genetics;
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
            genetics
          });
        } catch (dbErr) {
          this.log('error', `Database error for strain ${name}: ${dbErr.message}`);
          continue;
        }

        const variants = p.variants || [];
        for (const v of variants) {
          let seeds = this.parseSeedCount(v.title, p.title) || 1;
          const price = parseFloat(v.price);

          let availability = 'available';
          if (v.available === false || String(v.available) === 'false' || v.available === 0) {
            availability = 'out_of_stock';
          } else if (v.inventory_quantity !== undefined && v.inventory_quantity <= 0) {
            availability = v.inventory_policy === 'continue' ? 'orderable' : 'out_of_stock';
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

    }
  }

  async scrapeSingle(url) {
    this.log('info', `On-demand single page scrape starting for ${url}`);
    
    if (url.includes('/products/')) {
      const cleanUrl = url.split('?')[0].replace(/\/$/, '');
      const jsonUrl = cleanUrl.endsWith('.json') ? cleanUrl : `${cleanUrl}.json`;
      try {
        const jsonRes = await this.fetchWithRetry(jsonUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          }
        });
        if (jsonRes && jsonRes.ok) {
          const contentType = jsonRes.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await jsonRes.json();
            if (data && data.product) {
              const p = data.product;
              const title = p.title;
              if (!this.isInvalidStrainName(title)) {
                const breeder = this.normalizeBreeder(p.vendor, title);
                const name = this.normalizeStrainName(title, breeder);
                const description = p.body_html || '';
                const tags = p.tags || [];
                const type = this.determineStrainType(title, (Array.isArray(tags) ? tags.join(' ') : String(tags)) + ' ' + description);
                const seedType = this.extractSeedType(title, Array.isArray(tags) ? tags : [], description);
                const specs = this.parseShopifySpecs(description, Array.isArray(tags) ? tags : []);

                const strainId = await this.upsertStrain({
                  name,
                  breeder,
                  type,
                  seedType,
                  thc: specs.thc,
                  cbd: specs.cbd,
                  strainType: specs.strainType,
                  floweringTime: specs.floweringTime,
                  description,
                  genetics: specs.genetics || null
                });

                let offersCreated = 0;
                for (const v of (p.variants || [])) {
                  const optTitle = v.title || v.option1 || '';
                  const seeds = this.parseSeedCount(optTitle, title) || 1;
                  const price = parseFloat(v.price);
                  const availability = v.available ? 'available' : 'out_of_stock';
                  const variantUrl = `${cleanUrl}?variant=${v.id}`;
                  if (!isNaN(price) && price > 0) {
                    await this.insertOffer({
                      strainId,
                      shop: this.shopName,
                      url: variantUrl,
                      seeds,
                      price,
                      availability
                    });
                    offersCreated++;
                  }
                }
                return { name, breeder, shop: this.shopName, offersCreated };
              }
            }
          }
        }
      } catch (err) {
        this.log('warning', `Failed fetching product JSON for ${url}, falling back to HTML parsing: ${err.message}`);
      }
    }

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
    const breeder = this.normalizeBreeder(vendor, title);
    const name = this.normalizeStrainName(title, breeder);

    const description = productSchema.description || productSchema.body_html || '';
    let tags = productSchema.tags || [];
    if (!Array.isArray(tags) || tags.length === 0) {
      const tagsRe = /"tags"\s*:\s*(\[[^\]]*\])/i;
      const m = html.match(tagsRe);
      if (m) {
        try { tags = JSON.parse(m[1]); } catch {}
      }
    }

    const type = this.determineStrainType(title, html);

    const titleLower = title.toLowerCase();
    let seedType = this.extractSeedType(title, tags, description);

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
        let optTitle = o.name || o.title || '';
        if (!optTitle && o.url && variants.length > 0) {
          const varIdMatch = o.url.match(/variant=(\d+)/);
          if (varIdMatch) {
            const vObj = variants.find(v => String(v.id) === varIdMatch[1]);
            if (vObj) optTitle = vObj.title || vObj.name || vObj.option1 || '';
          }
        }
        const seeds = this.parseSeedCount(optTitle, title) || 1;
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
        const seeds = this.parseSeedCount(v.title, title) || 1;
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
        const seeds = this.parseSeedCount('', title) || 1;
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
    }

    return { name, breeder, shop: this.shopName, offersCreated };
  }
}
