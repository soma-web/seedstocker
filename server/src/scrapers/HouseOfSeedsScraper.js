import { ShopifyScraper } from './ShopifyScraper.js';

export class HouseOfSeedsScraper extends ShopifyScraper {
  constructor(logMessage, scrapeMode = 'price') {
    super('House of Seeds', logMessage, scrapeMode);
  }

  /**
   * Enhanced parseSeedCount for House of Seeds.
   * Handles variant titles, option names, and House of Seeds SKU patterns
   * (e.g., HH-US-FC-3 -> 3 seeds, SEN-NL5R-10 -> 10 seeds, GHS-MOD-1 -> 1 seed).
   */
  parseSeedCount(text, sku = '') {
    if (!text && !sku) return null;
    const str = `${text || ''} ${sku || ''}`.trim();

    // 1. Try standard base scraper parsing
    const baseCount = super.parseSeedCount(text);
    if (baseCount !== null && baseCount > 0) return baseCount;

    // 2. Try parsing explicitly passed SKU or text as SKU
    const skuToTest = sku || (typeof text === 'string' && text.includes('-') ? text : '');
    if (skuToTest) {
      const skuMatch = String(skuToTest).match(/[-_](\d+)\b/);
      if (skuMatch) {
        const num = parseInt(skuMatch[1], 10);
        if (num > 0 && num <= 100) return num;
      }
    }

    // 3. Match embedded SKU pattern inside text (e.g., "Default Title HH-US-FC-3")
    const embeddedSkuMatch = str.match(/\b[A-Z0-9]+(?:-[A-Z0-9]+)+-(\d+)\b/i);
    if (embeddedSkuMatch) {
      const num = parseInt(embeddedSkuMatch[1], 10);
      if (num > 0 && num <= 100) return num;
    }

    return null;
  }

  parseMetafieldsFromHtml(html) {
    const specs = super.parseMetafieldsFromHtml(html);

    if (!specs.strainType) {
      const iconsRowRe = /<h3[^>]*class=["']icons-row-item__title["'][^>]*>([\s\S]*?)<\/h3>[\s\S]*?<div[^>]*class=["']icons-row-item(?:__text)?["'][^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/gi;
      let match;
      while ((match = iconsRowRe.exec(html)) !== null) {
        const title = match[1].replace(/<[^>]+>/g, ' ').trim().toLowerCase();
        const valueText = match[2].replace(/<[^>]+>/g, ' ').trim();
        if (title.includes('sativa / indica') || title.includes('genetics') || title.includes('genetik') || title.includes('typ')) {
          specs.strainType = valueText;
          break;
        }
      }
    }

    return specs;
  }

  /**
   * Parse offers directly from product HTML for URL price scraper.
   */
  async parseOffersFromHtml(html, url) {
    const offers = [];

    // 1. Try Shopify Analytics / product meta object
    const metaMatch = html.match(/var meta = (\{[\s\S]*?\});/i);
    if (metaMatch) {
      try {
        const metaObj = JSON.parse(metaMatch[1]);
        const product = metaObj.product;
        if (product && Array.isArray(product.variants)) {
          for (const v of product.variants) {
            const price = parseFloat(v.price) / 100; // price in cents
            if (isNaN(price) || price <= 0) continue;
            const seeds = this.parseSeedCount(v.name || v.public_title || v.title, v.sku) || 1;
            offers.push({
              seeds,
              price,
              availability: 'available'
            });
          }
          if (offers.length > 0) return offers;
        }
      } catch {}
    }

    // 2. Try JSON-LD Product schema
    const jsonLdRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = jsonLdRe.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(m[1]);
        if (parsed && (parsed['@type'] === 'Product' || parsed['@type'] === 'ProductGroup')) {
          const rawOffers = Array.isArray(parsed.offers) ? parsed.offers : (parsed.offers ? [parsed.offers] : []);
          for (const o of rawOffers) {
            const price = parseFloat(o.price);
            if (isNaN(price) || price <= 0) continue;
            const sku = o.sku || parsed.sku || '';
            const seeds = this.parseSeedCount(o.name || parsed.name, sku) || 1;
            const availStr = String(o.availability || '').toLowerCase();
            const availability = (availStr.includes('instock') || availStr.includes('in_stock')) ? 'available' : 'out_of_stock';
            offers.push({ seeds, price, availability });
          }
          if (offers.length > 0) return offers;
        }
      } catch {}
    }

    return offers;
  }

  /**
   * Override scrapeSingle to fix base ShopifyScraper reference errors
   * and correctly extract seeds using SKU when variant title is "Default Title".
   */
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
    
    let productSchema = null;
    const jsonLdRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = jsonLdRe.exec(html)) !== null) {
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
      const metaMatch = html.match(/var meta = (\{[\s\S]*?\});/i);
      if (metaMatch) {
        try {
          const metaObj = JSON.parse(metaMatch[1]);
          if (metaObj.product) productSchema = metaObj.product;
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
    const titleLower = title.toLowerCase();

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
      if (extraSpecs.thc) thc = extraSpecs.thc;
      if (extraSpecs.cbd) cbd = extraSpecs.cbd;
      if (extraSpecs.strainType) strainType = extraSpecs.strainType;
      if (extraSpecs.floweringTime) floweringTime = extraSpecs.floweringTime;
      if (extraSpecs.genetics) genetics = extraSpecs.genetics;
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
        url: v.offers?.url,
        sku: v.sku
      }));
    }
    const variants = productSchema.variants || [];

    if (variants.length > 0) {
      for (const v of variants) {
        const seeds = this.parseSeedCount(v.title, v.sku) || 1;
        const price = typeof v.price === 'number' && v.price > 100 ? v.price / 100 : parseFloat(v.price);
        const availability = v.available !== false ? 'available' : 'out_of_stock';

        if (!isNaN(price)) {
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
    } else if (Array.isArray(offersList) && offersList.length > 0) {
      for (const o of offersList) {
        const optTitle = o.name || o.title || '';
        const sku = o.sku || productSchema.sku || '';
        const seeds = this.parseSeedCount(optTitle, sku) || 1;
        const price = parseFloat(o.price);
        const availability = o.availability?.includes('InStock') ? 'available' : 'out_of_stock';

        if (!isNaN(price)) {
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
      }
    } else {
      const sku = productSchema.sku || '';
      const price = parseFloat(productSchema.offers?.price || productSchema.price);
      if (!isNaN(price)) {
        const seeds = this.parseSeedCount(title, sku) || 1;
        const availability = productSchema.offers?.availability?.includes('InStock') ? 'available' : 'out_of_stock';
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
