import { BaseScraper } from './BaseScraper.js';

export class LindaSeedsScraper extends BaseScraper {
  constructor(logMessage, scrapeMode = 'price') {
    super('Linda Seeds', logMessage, scrapeMode);
    this.baseUrl = 'https://www.linda-seeds.com';
  }

  getHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cookie': 'language=de; currency=EUR'
    };
  }

  /**
   * Parse flowering duration string according to Linda Seeds conventions.
   * User requirement: Blütedauer: "mittel" means "8-10 Wochen".
   */
  parseFloweringTime(text = '') {
    if (!text) return { floweringTime: null, floweringMin: null, floweringMax: null };
    const lower = String(text).trim().toLowerCase();

    if (lower.includes('mittel')) {
      return { floweringTime: '8-10 Wochen', floweringMin: 8, floweringMax: 10 };
    }
    if (lower.includes('kurz')) {
      return { floweringTime: '6-8 Wochen', floweringMin: 6, floweringMax: 8 };
    }
    if (lower.includes('sehr lang')) {
      return { floweringTime: '12-14 Wochen', floweringMin: 12, floweringMax: 14 };
    }
    if (lower.includes('lang')) {
      return { floweringTime: '10-12 Wochen', floweringMin: 10, floweringMax: 12 };
    }

    // Direct numeric week matching (e.g., "7-8 Wochen", "8-9 Wochen", "7 - 8")
    const weeksMatch = lower.match(/(\d+)\s*(?:-\s*(\d+))?\s*(?:wochen?|weeks?)/i);
    if (weeksMatch) {
      const min = parseInt(weeksMatch[1], 10);
      const max = weeksMatch[2] ? parseInt(weeksMatch[2], 10) : min;
      const str = max > min ? `${min}-${max} Wochen` : `${min} Wochen`;
      return { floweringTime: str, floweringMin: min, floweringMax: max };
    }

    // Days matching (e.g., "55-65 Tage" -> ~8-9 Wochen)
    const daysMatch = lower.match(/(\d+)\s*(?:-\s*(\d+))?\s*tage/i);
    if (daysMatch) {
      const minDays = parseInt(daysMatch[1], 10);
      const maxDays = daysMatch[2] ? parseInt(daysMatch[2], 10) : minDays;
      const minWeeks = Math.floor(minDays / 7);
      const maxWeeks = Math.ceil(maxDays / 7);
      return {
        floweringTime: `${minWeeks}-${maxWeeks} Wochen`,
        floweringMin: minWeeks,
        floweringMax: maxWeeks
      };
    }

    return { floweringTime: null, floweringMin: null, floweringMax: null };
  }

  /**
   * Parse THC content according to Linda Seeds conventions.
   * User requirement: THC-Gehalt: "sehr hoch" means "25-30%".
   */
  parseThc(text = '') {
    if (!text) return null;
    const lower = String(text).trim().toLowerCase();

    // Explicit percentage in text (e.g., "bis zu 35 %", "28% THC", "25-30%")
    const explicitMatch = lower.match(/(?:bis\s+zu\s+)?(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?)\s*%/);
    if (explicitMatch) {
      const val = explicitMatch[1].replace(/\s+/g, '');
      return val.includes('%') ? val : `${val}%`;
    }

    if (lower.includes('sehr hoch') || lower.includes('extrem hoch')) {
      return '25-30%';
    }
    if (lower.includes('hoch')) {
      return '20-25%';
    }
    if (lower.includes('mittel') || lower.includes('normal')) {
      return '15-20%';
    }
    if (lower.includes('gering') || lower.includes('niedrig') || lower.includes('wenig')) {
      return '0-10%';
    }

    return null;
  }

  /**
   * Extract genotype (Indica, Sativa, Hybrid) from text or properties table.
   * User requirement: Try to extract as much information as possible from description / subtitle.
   */
  parseGenotype(text = '') {
    if (!text) return null;
    const lower = String(text).trim().toLowerCase();

    if (lower.includes('mehr indica') || lower.includes('mostly indica') || lower.includes('indica dominant') || lower.includes('indicadominiert')) {
      return 'Mostly Indica';
    }
    if (lower.includes('mehr sativa') || lower.includes('mostly sativa') || lower.includes('sativa dominant') || lower.includes('sativadominiert')) {
      return 'Mostly Sativa';
    }
    if (lower.includes('hybrid') || lower.includes('indica sativa') || lower.includes('sativa indica') || lower.includes('ausgewogen')) {
      return 'Hybrid';
    }
    if (lower.includes('indica')) {
      return 'Indica';
    }
    if (lower.includes('sativa')) {
      return 'Sativa';
    }

    return null;
  }

  /**
   * Extract seed type & strain type (autoflower vs photoperiodic, regular vs feminized).
   * User requirement: Samentyp: kann regulär oder feminisiert sein mit der ergänzung autoflowering, selbstblühend wenn autoflower.
   */
  parseSeedAndPlantType(text = '', categoryUrl = '') {
    const combined = `${text} ${categoryUrl}`.toLowerCase();

    let plantType = 'photoperiodic';
    if (
      combined.includes('autoflowering') ||
      combined.includes('autoflower') ||
      combined.includes('selbstblühend') ||
      combined.includes('blüht automatisch') ||
      combined.includes('automatic') ||
      /\bauto\b/i.test(combined)
    ) {
      plantType = 'autoflower';
    } else if (
      combined.includes('fast flowering') ||
      combined.includes('fast-flowering') ||
      combined.includes('fast version') ||
      combined.includes('fast-version') ||
      combined.includes('schnellblühend') ||
      /\bff\b/i.test(combined) ||
      /\bfast\b/i.test(combined)
    ) {
      plantType = 'fast_flowering';
    }

    let seedType = 'feminized';
    if (combined.includes('regulär') || combined.includes('regulaer') || combined.includes('regular') || /\breg\b/i.test(combined)) {
      seedType = 'regular';
    }

    return { plantType, seedType };
  }

  /**
   * Parse variant options & prices from Linda Seeds product HTML.
   * Compatible with run-url-price-scraper.js via parseOffersFromHtml.
   */
  async parseOffersFromHtml(html, url = '') {
    if (!html) return [];
    const offers = [];

    // 1. Look for product ID forms & select dropdowns
    const pidMatch = html.match(/name="(?:X)?cart_insert_(\d+)"/i) ||
      html.match(/id="price(\d+)"/i) ||
      html.match(/products_id["']?\s*value=["']?(\d+)/i);

    const productId = pidMatch ? pidMatch[1] : null;

    // Extract options from <select name="id7"...>
    const selectMatch = html.match(/<select[^>]*name=["']id7["'][^>]*>([\s\S]*?)<\/select>/i);
    if (selectMatch) {
      const optionMatches = [...selectMatch[1].matchAll(/<option[^>]*value=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/option>/gi)];

      for (let idx = 0; idx < optionMatches.length; idx++) {
        const optTag = optionMatches[idx][0];
        const optText = optionMatches[idx][2].replace(/&nbsp;/gi, ' ').trim();
        const isDisabled = /disabled/i.test(optTag);

        // Seed count from option text (e.g. "3 feminisierte Samen", "3 + 1 feminisierte Samen")
        const seeds = this.parseSeedCount(optText);
        if (!seeds) continue;

        let price = null;

        // Price is stored in hidden element: <div id="id_PRODUCTID_INDEX"...>...EUR...</div> or <div id="Xid_PRODUCTID_INDEX"...>
        if (productId) {
          const priceDivRegex = new RegExp(`id=["'](?:X)?id_${productId}_${idx}["'][^>]*>([\\s\\S]*?)<\\/div>`, 'i');
          const priceDivMatch = html.match(priceDivRegex);
          if (priceDivMatch) {
            // Unescape HTML entities inside price string (e.g. &lt;div class=&quot;h2 special&quot;&gt;34.50 EUR&lt;/div&gt;)
            const unescaped = priceDivMatch[1]
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&');

            const pMatch = unescaped.match(/([\d\.,]+)\s*EUR/i);
            if (pMatch) {
              price = parseFloat(pMatch[1].replace(',', '.'));
            }
          }
        }

        // Fallback price extraction if hidden div wasn't found for single option
        if (price === null || isNaN(price)) {
          const singlePriceMatch = html.match(/class=["']h2 special["'][^>]*>([\d\.,]+)\s*EUR/i) ||
            html.match(/([\d\.,]+)\s*EUR/i);
          if (singlePriceMatch) {
            price = parseFloat(singlePriceMatch[1].replace(',', '.'));
          }
        }

        if (price && !isNaN(price) && price > 0) {
          const seedType = optText.toLowerCase().includes('regulär') ? 'regular' : 'feminized';
          offers.push({
            seeds,
            price,
            availability: isDisabled ? 'out_of_stock' : 'available',
            seedType
          });
        }
      }
    }

    // 2. Fallback if no select element was present (single variant pages)
    if (offers.length === 0) {
      const priceMatch = html.match(/property=["']product:price:amount["']\s*content=["']([\d\.]+)["']/i) ||
        html.match(/class=["']h2 special["'][^>]*>([\d\.,]+)\s*EUR/i);

      if (priceMatch) {
        const price = parseFloat(priceMatch[1].replace(',', '.'));
        const seeds = this.parseSeedCount(html) || 1;
        if (price && !isNaN(price) && price > 0) {
          offers.push({
            seeds,
            price,
            availability: 'available'
          });
        }
      }
    }

    return offers;
  }

  /**
   * Helper to parse seed count from text strings.
   */
  parseSeedCount(text = '') {
    if (!text) return null;
    const str = String(text).trim();

    // N+M promo format (e.g., "3 + 1", "5 + 2", "10 + 3")
    const promoMatch = str.match(/^(\d+)\s*\+/);
    if (promoMatch) {
      const num = parseInt(promoMatch[1], 10);
      if (!isNaN(num) && num > 0 && num <= 1000) return num;
    }

    // German & English keywords
    const match = str.match(/(\d+)\s*(?:\+\s*\d+\s*)?(?:feminisierte|reguläre)?\s*(?:samen|seeds|stk|stück|er)\b/i) ||
      str.match(/pack(?:ung)?[\s-]*(?:von|of)?[\s-]*(\d+)/i) ||
      str.match(/^(\d+)$/);

    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0 && num <= 1000) {
        return num;
      }
    }

    return null;
  }

  /**
   * Main catalog scraping function.
   */
  async scrape(scraperStatus, targetUrl = null) {
    this.log('info', 'Starting Linda Seeds scraper...');
    scraperStatus.currentShop = this.shopName;

    const limit = this.getLimit();
    const productUrlMap = new Map(); // url -> taxonomy hint object

    const defaultCategories = [
      'https://www.linda-seeds.com/de/feminisierte-hanfsamen-kaufen',
      'https://www.linda-seeds.com/de/autoflowering-hanfsamen-kaufen',
      'https://www.linda-seeds.com/de/regulaere-hanfsamen-kaufen',
      'https://www.linda-seeds.com/de/cbd-hanfsamen-kaufen'
    ];

    let categoryUrls = defaultCategories;
    if (targetUrl) {
      categoryUrls = targetUrl.split(',').map(u => u.trim()).filter(Boolean);
    }

    // 1. Crawl category pages
    for (const catUrl of categoryUrls) {
      if (limit !== null && productUrlMap.size >= limit) break;

      // If a single product URL was directly passed as targetUrl
      if (
        catUrl.includes('/de/') &&
        !catUrl.endsWith('/feminisierte-hanfsamen-kaufen') &&
        !catUrl.endsWith('/autoflowering-hanfsamen-kaufen') &&
        !catUrl.endsWith('/regulaere-hanfsamen-kaufen') &&
        !catUrl.endsWith('/cbd-hanfsamen-kaufen') &&
        !catUrl.includes('/page-')
      ) {
        // Direct product URL check
        if (catUrl.split('/').length >= 6) {
          const taxonomy = this.parseSeedAndPlantType('', catUrl);
          productUrlMap.set(catUrl, taxonomy);
          continue;
        }
      }

      this.log('info', `Crawling category: ${catUrl}`);
      let page = 1;
      let keepCrawling = true;

      while (keepCrawling) {
        if (limit !== null && productUrlMap.size >= limit) break;

        const pageUrl = page === 1 ? catUrl : `${catUrl.replace(/\/$/, '')}/page-${page}`;
        this.log('info', `Fetching category page: ${pageUrl}`);

        let res;
        try {
          res = await this.fetchWithRetry(pageUrl, { headers: this.getHeaders() });
        } catch (err) {
          this.log('error', `Failed fetching category page ${pageUrl}: ${err.message}`);
          break;
        }

        if (!res || !res.ok) {
          this.log('warning', `Category page ${pageUrl} returned status ${res?.status || 'error'}. Stopping pagination.`);
          break;
        }

        const html = await res.text();
        let newFoundOnPage = 0;

        // Extract product links from LD+JSON ItemList or HTML hrefs
        const ldMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
        for (const m of ldMatches) {
          try {
            const data = JSON.parse(m[1]);
            const items = Array.isArray(data) ? data : (data.itemListElement || []);
            for (const item of items) {
              const u = item.url || item.item?.url;
              if (u && u.includes('linda-seeds.com/de/')) {
                if (!productUrlMap.has(u)) {
                  const taxonomy = this.parseSeedAndPlantType('', u);
                  productUrlMap.set(u, taxonomy);
                  newFoundOnPage++;
                }
              }
            }
          } catch { }
        }

        // Extract product links from HTML hrefs matching category path
        const hrefMatches = [...html.matchAll(/href=["'](https:\/\/www\.linda-seeds\.com\/de\/[^\s"#?]+)["']/gi)];
        for (const m of hrefMatches) {
          const u = m[1];
          // Filter out navigation & filter links
          if (
            !u.endsWith('/feminisierte-hanfsamen-kaufen') &&
            !u.endsWith('/autoflowering-hanfsamen-kaufen') &&
            !u.endsWith('/regulaere-hanfsamen-kaufen') &&
            !u.endsWith('/cbd-hanfsamen-kaufen') &&
            !u.includes('/page-') &&
            !u.endsWith('/sativa') &&
            !u.endsWith('/indica') &&
            !u.endsWith('/hybrid') &&
            !u.includes('/authors/') &&
            !u.includes('/home-grow/') &&
            !u.includes('/login') &&
            !u.includes('/shopping_cart') &&
            !productUrlMap.has(u)
          ) {
            // Validate product URL depth
            if (u.split('/').length >= 6) {
              const taxonomy = this.parseSeedAndPlantType('', u);
              productUrlMap.set(u, taxonomy);
              newFoundOnPage++;
            }
          }
        }

        this.log('info', `Page ${page} yielded ${newFoundOnPage} new product links (total queued: ${productUrlMap.size})`);
        if (newFoundOnPage === 0 || (limit !== null && productUrlMap.size >= limit)) {
          keepCrawling = false;
        } else {
          page++;
        }
      }
    }

    const productEntries = limit !== null
      ? Array.from(productUrlMap.entries()).slice(0, limit)
      : Array.from(productUrlMap.entries());

    this.log('info', `Queued ${productEntries.length} unique product URLs for Linda Seeds parsing.`);

    await this.clearOffers();

    // 2. Parse product detail pages
    for (let i = 0; i < productEntries.length; i++) {
      const [url, taxonomy] = productEntries[i];
      this.log('info', `[${i + 1}/${productEntries.length}] Parsing product: ${url}`);

      let res;
      try {
        res = await this.fetchWithRetry(url, { headers: this.getHeaders() });
      } catch (err) {
        this.log('error', `Failed fetching product page ${url}: ${err.message}`);
        continue;
      }

      if (!res || !res.ok) {
        this.log('warning', `Product page ${url} returned status ${res?.status || 'error'}`);
        continue;
      }

      const html = await res.text();

      // Extract raw title & breeder
      const titleH1Match = html.match(/<p class=["']h1["'][^>]*>([\s\S]*?)<\/p>/i) ||
        html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

      let rawTitle = titleH1Match ? titleH1Match[1].replace(/<[^>]+>/g, '').trim() : '';

      // Breeder from main product header (color-e52173) or description header
      const breederMatch = html.match(/class=["']color-e52173["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
        html.match(/class=["']product_description_h3["'][^>]*>[\s\S]*?\|\s*([^<]+)<\/h3>/i) ||
        html.match(/Samen von\s+([A-Za-z0-9\s\.-]+)/i);

      let rawBreeder = breederMatch ? breederMatch[1].replace(/<[^>]+>/g, '').trim() : 'Linda Seeds';
      const breeder = this.normalizeBreeder(rawBreeder);

      // Clean strain title
      let name = rawTitle
        .replace(/Samen von\s+.*/i, '')
        .replace(/Samen\b/i, '')
        .replace(/Cannabissamen\b/i, '')
        .replace(/Hanfsamen\b/i, '')
        .trim();

      name = this.normalizeStrainName(name, breeder);

      if (this.isInvalidStrainName(name, html, breeder)) {
        this.log('info', `Skipping invalid product: "${name}" (${breeder})`);
        continue;
      }

      // Extract properties table elements (Eigenschaften)
      const properties = {};
      const detailRowMatches = [...html.matchAll(/<div class=["']product_detail row["'][^>]*>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/div>/gi)];

      for (const drm of detailRowMatches) {
        const key = drm[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim().toLowerCase();
        const val = drm[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim();
        properties[key] = val;
      }

      // Extract description
      const descMatch = html.match(/class=["']product_page_desc["'][^>]*>([\s\S]*?)<\/section>/i) ||
        html.match(/<div class=["']col-12 col-xl-8 product_page_desc["'][^>]*>([\s\S]*?)<\/div>/i);
      const description = descMatch ? descMatch[1].trim() : null;

      // Extract properties according to rules
      const floweringRange = this.parseFloweringTime(properties['blütedauer'] || properties['blütezeit'] || description || '');
      const thc = this.parseThc(properties['thc-gehalt'] || properties['thc'] || description || '');
      const strainType = this.parseGenotype(properties['genotyp'] || html || description || '');
      const genetics = properties['genetik'] || null;

      const pageTaxonomy = this.parseSeedAndPlantType(`${rawTitle} ${properties['samentyp'] || ''}`, url);
      const type = pageTaxonomy.plantType || taxonomy.plantType || 'photoperiodic';
      const seedType = pageTaxonomy.seedType || taxonomy.seedType || 'feminized';

      // Parse variant offers & prices
      const offers = await this.parseOffersFromHtml(html, url);

      if (offers.length === 0) {
        this.log('warning', `No offers extracted for ${name} at ${url}`);
        continue;
      }

      // Save/upsert strain and offers via BaseScraper logic
      for (const offer of offers) {
        const strainId = await this.upsertStrain({
          name,
          breeder,
          type,
          seedType: offer.seedType || seedType,
          thc,
          cbd: null,
          strainType,
          floweringTime: floweringRange.floweringTime,
          floweringMin: floweringRange.floweringMin,
          floweringMax: floweringRange.floweringMax,
          description,
          genetics,
          url,
          rawTitle,
          seeds: offer.seeds,
          price: offer.price
        });

        await this.insertOffer({
          strainId,
          shop: this.shopName,
          seeds: offer.seeds,
          price: offer.price,
          currency: 'EUR',
          availability: offer.availability,
          url
        });
      }
    }

    this.log('info', 'Linda Seeds scraper completed successfully.');
  }
}
