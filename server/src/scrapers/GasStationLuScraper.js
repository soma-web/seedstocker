import { ShopifyScraper } from './ShopifyScraper.js';
import { normalizeBreederName, KNOWN_BREEDERS } from './breeder-normalize.js';

export class GasStationLuScraper extends ShopifyScraper {
  constructor(logMessage, scrapeMode = 'price') {
    super('Gas Station LU', logMessage, scrapeMode);
  }

  normalizeBreeder(rawVendor, title = '') {
    let raw = rawVendor ? rawVendor.trim() : '';

    // If vendor is missing or generic "Gas Station", try to find breeder in title
    if (!raw || raw.toLowerCase() === 'gas station' || raw.toLowerCase() === 'gas-station' || raw.toLowerCase() === 'unknown') {
      // 1. Look for "by <Breeder>"
      const byMatch = title.match(/\sby\s+([^|(\n]+)/i);
      if (byMatch) {
        const found = normalizeBreederName(byMatch[1].trim());
        if (found) return found;
      }

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
        const found = normalizeBreederName(pipeMatch[1].trim());
        if (found && KNOWN_BREEDERS.has(found.toLowerCase())) {
          return found;
        }
      }

      return 'Gas Station LU';
    }

    const cleaned = normalizeBreederName(raw);
    return cleaned || 'Gas Station LU';
  }

  normalizeStrainName(title, breeder) {
    if (!title) return '';

    let name = title.trim();

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

    return result || title.trim();
  }

  parseSeedCount(variantTitle, productTitle = '') {
    // 1. Check variantTitle first if present and not "Default Title"
    if (variantTitle && typeof variantTitle === 'string' && variantTitle.trim().toLowerCase() !== 'default title') {
      const vMatch = variantTitle.match(/(\d+)/);
      if (vMatch) {
        const count = parseInt(vMatch[1], 10);
        if (!isNaN(count) && count > 0) return count;
      }
    }

    // 2. Check productTitle for seed count patterns (e.g., "10 seeds", "5 feminized seeds", "8+ seeds")
    if (productTitle && typeof productTitle === 'string') {
      const pMatch = productTitle.match(/(\d+)\+?\s*(?:feminized|feminised|regular|regulär|autoflower|autoflowering)?\s*seeds/i);
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
    if (/\bfeminized\b|\bfeminised\b|\bfem\b|\bs1\b|\bfems\b/i.test(combined)) {
      return 'feminized';
    }
    if (/\bautoflower\b|\bautoflowering\b|\bauto\b/i.test(combined)) {
      return 'autoflowering';
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

  async fetchWithRetry(url, options = {}, retries = 5, backoffMs = 3000) {
    let attempt = 0;
    while (attempt < retries) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ...(options.headers || {})
          },
          ...options
        });

        if (res.status === 429) {
          attempt++;
          const retryAfterHeader = res.headers.get('retry-after');
          let delay = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : backoffMs * Math.pow(2, attempt - 1);
          if (isNaN(delay) || delay <= 0) delay = backoffMs * Math.pow(2, attempt - 1);

          this.log('warning', `Received HTTP 429 (Too Many Requests) for ${url}. Waiting ${(delay / 1000).toFixed(1)}s before retry (attempt ${attempt}/${retries})...`);
          await this.sleep(delay);
          continue;
        }

        return res;
      } catch (err) {
        attempt++;
        if (attempt >= retries) throw err;
        this.log('warning', `Network error fetching ${url}: ${err.message}. Retrying in ${(backoffMs / 1000).toFixed(1)}s...`);
        await this.sleep(backoffMs);
      }
    }
    return null;
  }

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
        const breeder = this.normalizeBreeder(rawBreeder, p.title);
        const name = this.normalizeStrainName(p.title, breeder);

        let type = 'photoperiodic';
        if (tagsString.includes('autoflower') || tagsString.includes('auto') || 
            titleLower.includes('auto') || bodyHtml.includes('auto')) {
          type = 'autoflower';
        }

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
      await this.sleep(1500);
    }
  }
}
