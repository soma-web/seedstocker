import { BaseScraper } from './BaseScraper.js';

export class OaseedsScraper extends BaseScraper {
  constructor(logMessage, scrapeMode = 'discovery') {
    super('Oaseeds', logMessage, scrapeMode);
    this.baseUrl = 'https://oaseeds.com';
  }

  getHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9,de-DE;q=0.8,de;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    };
  }

  determineStrainType(title = '', text = '', url = '') {
    const titleLower = (title || '').toLowerCase();
    const textLower = (text || '').toLowerCase();
    const urlLower = (url || '').toLowerCase();

    // 1. Triploid
    if (
      titleLower.includes('triploid') ||
      textLower.includes('triploid') ||
      textLower.includes('triploide') ||
      urlLower.includes('triploid')
    ) {
      return 'triploid';
    }

    // 2. Autoflower
    const isAutoTitle = titleLower.includes('auto') ||
                        titleLower.includes('autoflower') ||
                        titleLower.includes('autoflowering') ||
                        titleLower.includes('automatica') ||
                        titleLower.includes('automatisch') ||
                        titleLower.includes('superauto');

    const isAutoUrl = urlLower.includes('auto') ||
                      urlLower.includes('autoflower') ||
                      urlLower.includes('automatica');

    const isAutoDesc = textLower.includes('autoflowering') ||
                       textLower.includes('autoflower') ||
                       textLower.includes('automatisch') ||
                       textLower.includes('automatica') ||
                       textLower.includes('auto-flowering');

    if (isAutoTitle || isAutoUrl || isAutoDesc) {
      return 'autoflower';
    }

    // 3. Fast Flowering
    const isFastTitle = titleLower.includes('fast flowering') ||
                        titleLower.includes('fast version') ||
                        /\bfast\b/i.test(titleLower);

    const isFastUrl = urlLower.includes('fast-version') ||
                      urlLower.includes('fast-flowering') ||
                      urlLower.includes('-fast.');

    const isFastDesc = textLower.includes('fast flowering') ||
                       textLower.includes('fast version') ||
                       textLower.includes('schnellblühend');

    if (isFastTitle || isFastUrl || isFastDesc) {
      return 'fast_flowering';
    }

    return 'photoperiodic';
  }

  parseSeedCount(text) {
    if (!text) return null;
    const str = String(text).trim();

    // Promo format check (e.g., "3+1", "5+2", "10+4")
    const promoMatch = str.match(/^(\d+)\s*\+/);
    if (promoMatch) {
      const num = parseInt(promoMatch[1], 10);
      if (!isNaN(num) && num > 0 && num <= 1000) return num;
    }

    return super.parseSeedCount(text);
  }

  async parseOffersFromHtml(html, url = null) {
    const offers = [];
    if (!html) return offers;

    // Extract default page price
    let defaultPrice = null;
    const priceMatch = html.match(/class=["'][^"']*current-price-value[^"']*["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/class=["'][^"']*current-price-value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) ||
                       html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i);
    if (priceMatch) {
      const rawP = (priceMatch[1] || priceMatch[0]).replace(/[^0-9.]/g, '');
      defaultPrice = parseFloat(rawP);
    }

    const cartBtnMatch = html.match(/<button[^>]*class=["'][^"']*add-to-cart[^"']*["'][^>]*>/i);
    let defaultAvail = (cartBtnMatch && cartBtnMatch[0].includes('disabled')) ? 'out_of_stock' : 'available';

    // Extract radio input variants
    const radios = [...html.matchAll(/<input[^>]*class=["'][^"']*input-radio[^"']*["'][^>]*name=["']group\[(\d+)\]["'][^>]*title=["']([^"']+)["'][^>]*value=["']([^"']+)["']/gi)];

    if (radios.length > 0) {
      for (const r of radios) {
        const groupId = r[1];
        const title = r[2];
        const attrValue = r[3];
        const isChecked = r[0].includes('checked');

        const seeds = this.parseSeedCount(title);
        if (!seeds) continue;

        let price = isChecked ? defaultPrice : null;
        let avail = defaultAvail;

        // If not default radio and URL provided, fetch price via PrestaShop AJAX refresh
        if (!price && url) {
          try {
            const cleanUrl = url.split('?')[0];
            const refreshUrl = `${cleanUrl}?ajax=1&action=refresh`;
            const formData = new URLSearchParams();
            formData.append(`group[${groupId}]`, attrValue);
            formData.append('ajax', '1');
            formData.append('action', 'refresh');

            const ajaxRes = await fetch(refreshUrl, {
              method: 'POST',
              headers: {
                ...this.getHeaders(),
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
              },
              body: formData.toString()
            });

            if (ajaxRes.ok) {
              const json = await ajaxRes.json();
              const pMatch = json.product_prices?.match(/content=["']([^"']+)["']/i) ||
                             json.product_prices?.match(/class=["'][^"']*current-price-value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
              if (pMatch) {
                price = parseFloat(pMatch[1].replace(/[^0-9.]/g, ''));
              }
              const ajaxCartBtn = json.product_add_to_cart?.match(/<button[^>]*class=["'][^"']*add-to-cart[^"']*["'][^>]*>/i);
              if (ajaxCartBtn && ajaxCartBtn[0].includes('disabled')) {
                avail = 'out_of_stock';
              }
            }
          } catch (err) {
            this.log('warning', `Failed to fetch variant price via AJAX for ${title} at ${url}: ${err.message}`);
          }
        }

        if (price && !isNaN(price) && price > 0) {
          offers.push({
            seeds,
            price,
            availability: avail
          });
        }
      }
    } else {
      // Single variant product (no radio inputs)
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const titleText = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '';
      const seeds = this.parseSeedCount(titleText) || 1;

      if (defaultPrice && !isNaN(defaultPrice) && defaultPrice > 0) {
        offers.push({
          seeds,
          price: defaultPrice,
          availability: defaultAvail
        });
      }
    }

    return offers;
  }

  async scrape(scraperStatus, targetUrl = null) {
    this.log('info', `Starting Oaseeds scraper (mode: ${this.scrapeMode})...`);
    if (scraperStatus) scraperStatus.currentShop = this.shopName;

    const productPageUrls = new Map(); // url -> { type, seedType }
    const limit = this.getLimit();

    if (targetUrl) {
      const urls = targetUrl.split(',').map(u => u.trim()).filter(Boolean);
      for (const u of urls) {
        let type = 'photoperiodic';
        let seedType = 'feminized';
        const lower = u.toLowerCase();
        if (lower.includes('autoflower') || lower.includes('auto')) {
          type = 'autoflower';
        } else if (lower.includes('fast-version') || lower.includes('fast')) {
          type = 'fast_flowering';
        }
        if (lower.includes('regular')) {
          seedType = 'regular';
        }

        if (u.endsWith('.html')) {
          // Direct product URL passed
          productPageUrls.set(u, { type, seedType });
        } else {
          // Category URL passed
          let page = 1;
          let keepCrawling = true;
          while (keepCrawling) {
            if (limit !== null && productPageUrls.size >= limit) break;
            const pageUrl = page === 1 ? u : `${u}?page=${page}`;
            let res;
            try {
              res = await this.fetchWithRetry(pageUrl, { headers: this.getHeaders() });
            } catch (err) {
              this.log('error', `Failed to fetch category page ${pageUrl}: ${err.message}`);
              break;
            }
            if (!res.ok) break;

            const html = await res.text();
            const productHrefs = [...html.matchAll(/href=["'](https:\/\/oaseeds\.com\/en\/[^"']+\.html)["']/gi)].map(m => m[1]);
            const uniquePageUrls = [...new Set(productHrefs)].filter(link => !link.includes('/service-login'));

            if (uniquePageUrls.length === 0) break;

            for (const link of uniquePageUrls) {
              if (!productPageUrls.has(link)) {
                productPageUrls.set(link, { type, seedType });
              }
              if (limit !== null && productPageUrls.size >= limit) break;
            }
            page++;
            await this.sleep(300);
          }
        }
      }
    } else {
      // Default 4 seed category URLs
      const categories = [
        { url: 'https://oaseeds.com/en/feminized-seeds', type: 'photoperiodic', seedType: 'feminized' },
        { url: 'https://oaseeds.com/en/fast-version', type: 'fast_flowering', seedType: 'feminized' },
        { url: 'https://oaseeds.com/en/autoflower-seeds', type: 'autoflower', seedType: 'feminized' },
        { url: 'https://oaseeds.com/en/regular-cannabis-seeds', type: 'photoperiodic', seedType: 'regular' }
      ];

      for (const cat of categories) {
        if (limit !== null && productPageUrls.size >= limit) break;
        this.log('info', `Crawling category index: ${cat.url}`);
        let page = 1;
        let keepCrawlingCat = true;

        while (keepCrawlingCat) {
          if (limit !== null && productPageUrls.size >= limit) break;
          const pageUrl = page === 1 ? cat.url : `${cat.url}?page=${page}`;
          this.log('info', `Fetching category page ${page}: ${pageUrl}`);

          let res;
          try {
            res = await this.fetchWithRetry(pageUrl, { headers: this.getHeaders() });
          } catch (err) {
            this.log('error', `Failed to fetch category page ${pageUrl}: ${err.message}`);
            break;
          }

          if (!res.ok) {
            this.log('warning', `Category page returned status ${res.status}`);
            break;
          }

          const html = await res.text();
          const productHrefs = [...html.matchAll(/href=["'](https:\/\/oaseeds\.com\/en\/[^"']+\.html)["']/gi)].map(m => m[1]);
          const uniquePageUrls = [...new Set(productHrefs)].filter(u => !u.includes('/service-login'));

          if (uniquePageUrls.length === 0) {
            this.log('info', `No more product links found for category ${cat.url} at page ${page}`);
            keepCrawlingCat = false;
            break;
          }

          this.log('info', `Found ${uniquePageUrls.length} product links on category page ${page}`);

          for (const url of uniquePageUrls) {
            if (!productPageUrls.has(url)) {
              productPageUrls.set(url, { type: cat.type, seedType: cat.seedType });
            }
            if (limit !== null && productPageUrls.size >= limit) break;
          }

          page++;
          await this.sleep(300);
        }
      }
    }

    this.log('info', `Total product URLs collected for scraping: ${productPageUrls.size}`);

    let processedCount = 0;
    for (const [url, catInfo] of productPageUrls.entries()) {
      processedCount++;
      this.log('info', `[${processedCount}/${productPageUrls.size}] Scraping product: ${url}`);

      let res;
      try {
        res = await this.fetchWithRetry(url, { headers: this.getHeaders() });
      } catch (err) {
        this.log('error', `Failed to fetch product ${url}: ${err.message}`);
        continue;
      }

      if (!res.ok) {
        this.log('warning', `Product page ${url} returned status ${res.status}`);
        continue;
      }

      const html = await res.text();

      // Extract metadata from JSON-LD, data-product, or HTML tags
      let rawTitle = '';
      let breeder = '';
      let description = '';

      // JSON-LD extraction
      const jsonLdMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      for (const m of jsonLdMatches) {
        try {
          const parsed = JSON.parse(m[1].replace(/<[^>]+>/g, '').trim());
          if (parsed['@type'] === 'ProductGroup' || parsed['@type'] === 'Product' || parsed.hasVariant) {
            if (!rawTitle && parsed.name) rawTitle = parsed.name;
            if (!breeder && parsed.brand?.name) breeder = parsed.brand.name;
            if (!description && parsed.description) description = parsed.description;
          }
        } catch (e) {}
      }

      // data-product attribute extraction fallback
      const dataProdMatch = html.match(/data-product=["']([^"']+)["']/i);
      if (dataProdMatch) {
        try {
          const decoded = dataProdMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'");
          const parsed = JSON.parse(decoded);
          if (!breeder && parsed.manufacturer_name) breeder = parsed.manufacturer_name;
          if (!rawTitle && parsed.name) rawTitle = parsed.name;
          if (!description && parsed.description) description = parsed.description;
        } catch (e) {}
      }

      // H1 / title fallback
      if (!rawTitle) {
        const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (h1Match) rawTitle = h1Match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }

      // Breeder fallback from "by <Breeder>" or Marke / Brand tags
      if (!breeder && rawTitle) {
        const byMatch = rawTitle.match(/\bby\s+([^<]+)$/i);
        if (byMatch) breeder = byMatch[1].trim();
      }
      if (!breeder) {
        const brandTag = html.match(/<div[^>]*class=["'][^"']*product-manufacturer[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                          html.match(/Marke:?\s*([^<\n]+)/i) ||
                          html.match(/Brand:?\s*([^<\n]+)/i);
        if (brandTag) breeder = (brandTag[1] || brandTag[0]).replace(/<[^>]+>/g, '').trim();
      }

      const normalizedBreeder = this.normalizeBreeder(breeder);
      const name = this.normalizeStrainName(rawTitle, normalizedBreeder);

      if (this.isInvalidStrainName(name, description, normalizedBreeder)) {
        this.log('info', `Skipping invalid/non-seed product: ${name} (${normalizedBreeder}) at ${url}`);
        continue;
      }

      // Extract THC
      let thc = null;
      if (description) {
        const thcMatch = description.match(/\bTHC\b:?\s*(?:up to|bis zu|over|über|approx\.?|ca\.?)?\s*([0-9]+(?:\.[0-9]+)?\s*%\s*(?:-\s*[0-9]+(?:\.[0-9]+)?\s*%)?|[0-9]+\s*-\s*[0-9]+\s*%|[0-9]+\s*%)/i) ||
                         description.match(/([0-9]+(?:\.[0-9]+)?\s*%)\s*THC/i) ||
                         description.match(/THC\s*(?:content|level|level of|gehalt|gehalt von)?\s*:?\s*(?:up to|bis zu|over|über|approx\.?|ca\.?)?\s*([0-9]+(?:\.[0-9]+)?\s*%\s*(?:-\s*[0-9]+(?:\.[0-9]+)?\s*%)?|[0-9]+\s*-\s*[0-9]+\s*%|[0-9]+\s*%)/i);
        if (thcMatch) thc = this.cleanThc(thcMatch[1] || thcMatch[0]);
      }

      // Extract CBD
      let cbd = null;
      if (description) {
        const cbdMatch = description.match(/\bCBD\b:?\s*(?:up to|bis zu|over|über|approx\.?|ca\.?)?\s*([0-9]+(?:\.[0-9]+)?\s*%\s*(?:-\s*[0-9]+(?:\.[0-9]+)?\s*%)?|[0-9]+\s*-\s*[0-9]+\s*%|[0-9]+\s*%)/i) ||
                         description.match(/([0-9]+(?:\.[0-9]+)?\s*%)\s*CBD/i);
        if (cbdMatch) cbd = this.cleanCbd(cbdMatch[1] || cbdMatch[0]);
      }

      // Extract Flowering Time
      let floweringTime = null;
      if (description) {
        const flowMatch = description.match(/(?:flowering time|flowering period|flowering|blütezeit|blütendauer):?\s*([0-9]+\s*(?:-\s*[0-9]+)?\s*(?:weeks|wochen|days|tage)?)/i);
        if (flowMatch) floweringTime = this.cleanFloweringTime(flowMatch[1]);
      }

      const strainType = this.normalizeStrainType(null, [rawTitle, description]);
      const offers = await this.parseOffersFromHtml(html, url);

      let finalType = catInfo.type;
      const detectedType = this.determineStrainType(rawTitle, description, url);
      if (detectedType !== 'photoperiodic' || !finalType) {
        finalType = detectedType;
      }

      const firstOffer = offers[0] || {};
      const strainId = await this.upsertStrain({
        name,
        breeder: normalizedBreeder,
        type: finalType,
        seedType: catInfo.seedType,
        thc,
        cbd,
        strainType,
        floweringTime,
        description,
        url,
        rawTitle,
        seeds: firstOffer.seeds || 1,
        price: firstOffer.price || 0
      });

      for (const offer of offers) {
        await this.insertOffer({
          strainId,
          url,
          seeds: offer.seeds,
          price: offer.price,
          availability: offer.availability
        });
      }

      await this.sleep(300);
    }

    this.log('info', `Oaseeds scraping complete. Processed ${processedCount} products.`);
  }
}
