import { ShopifyScraper } from './ShopifyScraper.js';
import { normalizeBreederName, KNOWN_BREEDERS } from './breeder-normalize.js';

export class GasStationCoScraper extends ShopifyScraper {
  constructor(logMessage, scrapeMode = 'price') {
    super('Gas Station Co. Seeds', logMessage, scrapeMode);
  }

  normalizeStrainName(title, breeder) {
    let name = title.trim();

    // Strip trailing "by <Breeder>" or "von <Breeder>" from title if it matches a known breeder
    const byMatch = name.match(/\s+(by|von)\s+(.+)$/i);
    if (byMatch) {
      const candidateBreeder = byMatch[2].trim().toLowerCase();
      if (KNOWN_BREEDERS.has(candidateBreeder) || (breeder && candidateBreeder === breeder.toLowerCase())) {
        name = name.substring(0, byMatch.index).trim();
      }
    }

    // Find last dash (regular, en-dash, em-dash) — with or without leading space
    const dashRe = /\s*[-–—]\s+/g;
    let lastMatch = null;
    let m;
    while ((m = dashRe.exec(name)) !== null) lastMatch = m;
    if (lastMatch) {
      const before = name.substring(0, lastMatch.index).trim();
      const after = name.substring(lastMatch.index + lastMatch[0].length).trim();
      const afterLower = after.toLowerCase();
      const beforeLower = before.toLowerCase();

      // After side is entirely the breeder
      if (KNOWN_BREEDERS.has(afterLower) || (breeder && afterLower === breeder.toLowerCase())) {
        name = before;
      }
      // Before side is entirely the breeder
      else if (KNOWN_BREEDERS.has(beforeLower) || (breeder && beforeLower === breeder.toLowerCase())) {
        name = after;
      }
      // Breeder appears at start of after → strip breeder + remaining noise from after
      else if (breeder && afterLower.startsWith(breeder.toLowerCase())) {
        name = before;
      }
      // Breeder appears at end of after → strip breeder from after
      else if (breeder && afterLower.endsWith(breeder.toLowerCase())) {
        const stripped = after.substring(0, after.length - breeder.length).trim().replace(/[\s\-–—]+$/, '').trim();
        // If remaining is empty, looks like genetics info, or contains only seed-type noise, use before
        if (!stripped || /^\(|^x\s/i.test(stripped) || !super.normalizeStrainName(stripped, breeder).trim()) {
          name = before;
        } else {
          name = stripped;
        }
      }
      // Breeder is before side (starts with breeder)
      else if (breeder && beforeLower.startsWith(breeder.toLowerCase())) {
        name = after;
      }
    }

    // Delegate to base for keyword stripping
    let result = super.normalizeStrainName(name, breeder);
    result = result.replace(/[\s|]+$/, '').trim();
    return result;
  }

  extractBreeder(product) {
    const body = product.body_html || '';

    // 1. body_html: <span>Marke: ...</span>
    const markeMatch = body.match(/<span[^>]*>\s*Marke:\s*([^<]+)<\/span>/i);
    if (markeMatch) return this.cleanBreeder(markeMatch[1]);

    // 2. body_html: Breeder: ...
    const breederMatch = body.match(/Breeder:\s*([^\n<]+)/i);
    if (breederMatch) return this.cleanBreeder(breederMatch[1]);

    // 3. body_html: Brand: ...
    const brandMatch = body.match(/Brand:\s*([^<\n]+)/i);
    if (brandMatch) return this.cleanBreeder(brandMatch[1]);

    // 4. Title parsing
    const title = product.title || '';

    // 4a. "... ) Breeder" - skip genetics crosses (starting with x/X)
    const afterParens = title.match(/\)\s*(.+)$/);
    if (afterParens) {
      const after = afterParens[1].trim();
      if (/^x\s+/i.test(after)) {
        const nextParen = after.match(/^x\s+[^(]+\)\s*(.+)$/);
        if (nextParen) return this.cleanBreeder(nextParen[1]);
      } else if (after && !after.includes('(')) {
        return this.cleanBreeder(after);
      }
    }

    // 4b. "Breeder - Strain" or "Strain - Breeder" (also en-dash/em-dash)
    const dashRe = /\s*[-–—]\s+/g;
    let lastDashMatch = null;
    let dm;
    while ((dm = dashRe.exec(title)) !== null) lastDashMatch = dm;
    if (lastDashMatch) {
      const afterDash = title.substring(lastDashMatch.index + lastDashMatch[0].length).trim();
      const beforeDash = title.substring(0, lastDashMatch.index).trim();

      const afterClean = this.cleanBreeder(afterDash);
      const beforeClean = this.cleanBreeder(beforeDash);
      const afterMatch = KNOWN_BREEDERS.has(afterClean.toLowerCase());
      const beforeMatch = KNOWN_BREEDERS.has(beforeClean.toLowerCase());

      if (afterMatch && !beforeMatch) return afterClean;
      if (beforeMatch && !afterMatch) return beforeClean;
      // Neither matches directly: try stripping parenthetical genetics from afterDash
      if (!afterMatch && !beforeMatch) {
        const stripped = afterDash.replace(/\s*\(.*\)\s*$/, '').trim();
        const strippedClean = this.cleanBreeder(stripped);
        if (stripped && KNOWN_BREEDERS.has(strippedClean.toLowerCase())) return strippedClean;
      }
      // Both or neither match: prefer afterDash (more common pattern)
      if (!afterDash.includes('(') && !/\s+x\s+/i.test(afterDash)) return afterClean;
      if (!beforeDash.includes('(') && !/\s+x\s+/i.test(beforeDash)) return beforeClean;
    }

    // 4c. "... | Breeder"
    const pipeMatch = title.match(/\s+\|\s+(.+)$/);
    if (pipeMatch) return this.cleanBreeder(pipeMatch[1]);

    // 4d. "... by Breeder"
    const byMatch = title.match(/\s+by\s+(.+)$/i);
    if (byMatch) return this.cleanBreeder(byMatch[1]);

    // 5. Fallback
    return 'Gas Station Co. Seeds';
  }

  cleanBreeder(raw) {
    return normalizeBreederName(raw) || 'Gas Station Co. Seeds';
  }

  parseMetafieldsFromHtml(html) {
    // Start with whatever base class extracts (like THC, CBD, etc.)
    const specs = super.parseMetafieldsFromHtml(html) || {};

    // ── Flowering Time for Gas Station (converting days to weeks) ────────────────
    const flowerMatch = html.match(/Flowering\s*Time[:\s]+(\d+)\s*[-–]\s*(\d+)\s*days/i)
                     || html.match(/Flowering\s*Time[:\s]+(\d+)\s*days/i);
    if (flowerMatch) {
      if (flowerMatch[2]) {
        const minW = Math.round(parseInt(flowerMatch[1]) / 7);
        const maxW = Math.round(parseInt(flowerMatch[2]) / 7);
        specs.floweringTime = `${minW}-${maxW}`;
      } else {
        specs.floweringTime = String(Math.round(parseInt(flowerMatch[1]) / 7));
      }
    }

    // ── Strain Type / Ratio for Gas Station (Indica/Sativa ratio or genetics word) ──
    const ratioMatch = html.match(/\b\d{2}\s*[\/\\:]\s*\d{2}\b/);
    if (ratioMatch) {
      specs.strainType = 'hybrid';
    } else {
      const typeMatch = html.match(/Genetics[:\s]+(Hybrid|Indica|Sativa)/i);
      if (typeMatch) {
        const val = typeMatch[1].toLowerCase();
        if (val.includes('indica') && val.includes('sativa')) specs.strainType = 'hybrid';
        else if (val.includes('indica')) specs.strainType = 'indica';
        else if (val.includes('sativa')) specs.strainType = 'sativa';
        else if (val.includes('hybrid')) specs.strainType = 'hybrid';
      }
    }

    // ── Genetics / Lineage ────────────────────────────────────────────────────────
    const lineageMatch = html.match(/Lineage[:\s]+([^<\n|]+)/i);
    if (lineageMatch) {
      const cleanLineage = lineageMatch[1]
        .split(/Flower Yield:|Hash Yield:|Seed Type:|Indica \/ Sativa:|Indoor \/ Outdoor:|Flowering Time:|Genetics:/i)[0]
        .trim();
      specs.genetics = cleanLineage;
    }

    return specs;
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
        const vendorLower = (p.vendor || '').toLowerCase();

        const isKnownSeedVendor = vendorLower.includes('gas station');
        const isSeed = isKnownSeedVendor ||
                       productType === 'cannabissamen' ||
                       productType === 'sämlinge' ||
                       tagsString.includes('samen') ||
                       tagsString.includes('seeds') ||
                       tagsString.includes('sämling') ||
                       titleLower.includes('samen') ||
                       titleLower.includes('seeds') ||
                       titleLower.includes('sämling');

        if (!isSeed || productType === 'displays' || tagsString.includes('pos-only') || tagsString.includes('pos only') || tagsString.includes('wholesale-only') || this.isInvalidStrainName(p.title, p.body_html)) {
          continue;
        }

        if (limit !== null && scrapedCount >= limit) {
          this.log('info', `Scraped limit of ${limit} strains for ${this.shopName}. Stopping scan.`);
          hasMore = false;
          break;
        }
        scrapedCount++;

        scraperStatus.currentProduct = p.title;

        const rawBreeder = this.extractBreeder(p);
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
            genetics
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
    if (this.isInvalidStrainName(title, html)) {
      this.log('warning', `Skipping single page scrape for invalid/collection strain: ${title}`);
      return null;
    }

    const rawBreeder = this.extractBreeder({
      title,
      body_html: productSchema.description || productSchema.body_html || '',
      vendor: productSchema.brand?.name || productSchema.vendor || ''
    });
    const breeder = this.normalizeBreeder(rawBreeder);
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
}
