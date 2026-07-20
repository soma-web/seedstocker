import { BaseScraper } from './BaseScraper.js';

export class DutchPassionScraper extends BaseScraper {
  constructor(logMessage, scrapeMode = 'price') {
    super('Dutch Passion', logMessage, scrapeMode);
  }

  async scrape(scraperStatus, targetUrl = null) {
    this.log('info', 'Starting Dutch Passion scraper...');
    scraperStatus.currentShop = this.shopName;

    const limit = this.getLimit();
    const productUrls = new Set();

    let categoryUrls = ['https://dutch-passion.com/de/hanfsamen'];
    if (targetUrl) {
      categoryUrls = targetUrl.split(',').map(u => u.trim()).filter(Boolean);
    }

    for (const catUrl of categoryUrls) {
      if (limit !== null && productUrls.size >= limit) break;

      // If single product URL provided directly
      if (catUrl.includes('/de/hanfsamen/') || catUrl.includes('/de/cannabissamen/')) {
        const isPage = catUrl.includes('page=') || catUrl.includes('p=');
        if (!isPage) {
          productUrls.add(catUrl);
          continue;
        }
      }

      this.log('info', `Crawling category index: ${catUrl}`);
      let page = 1;
      let keepCrawling = true;

      while (keepCrawling) {
        if (limit !== null && productUrls.size >= limit) break;

        const pageUrl = catUrl.includes('?') ? `${catUrl}&page=${page}` : `${catUrl}?page=${page}`;
        this.log('info', `Fetching category page: ${pageUrl}`);

        let res;
        try {
          res = await this.fetchWithRetry(pageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept-Language': 'de-DE,de;q=0.9',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          });
        } catch (err) {
          this.log('error', `Failed fetching category page ${pageUrl}: ${err.message}`);
          break;
        }

        if (!res.ok) {
          this.log('warning', `Category page ${pageUrl} returned status ${res.status}. Stopping pagination.`);
          break;
        }

        const html = await res.text();
        let newFoundOnPage = 0;

        // 1. Extract from LD+JSON Product items
        const ldMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
        for (const m of ldMatches) {
          if (m[1].includes('"@type": "Product"') || m[1].includes('"@type":"Product"')) {
            try {
              const data = JSON.parse(m[1]);
              if (data.url && (data.url.includes('/de/hanfsamen/') || data.url.includes('/de/cannabissamen/'))) {
                if (!productUrls.has(data.url)) {
                  productUrls.add(data.url);
                  newFoundOnPage++;
                }
              }
            } catch {}
          }
        }

        // 2. Extract from href matches
        const hrefMatches = [...html.matchAll(/href="(https:\/\/dutch-passion\.com\/de\/(?:hanfsamen|cannabissamen)\/[^"#?]+)"/gi)];
        for (const m of hrefMatches) {
          const u = m[1];
          if (!u.endsWith('/hanfsamen') && !u.endsWith('/cannabissamen') && !productUrls.has(u)) {
            productUrls.add(u);
            newFoundOnPage++;
          }
        }

        this.log('info', `Page ${page} yielded ${newFoundOnPage} new product links (total queued: ${productUrls.size})`);
        if (newFoundOnPage === 0) {
          keepCrawling = false;
        } else {
          page++;
        }
      }
    }

    this.log('info', `Queued ${productUrls.size} product URLs for parsing.`);

    let scrapedCount = 0;
    for (const url of productUrls) {
      if (limit !== null && scrapedCount >= limit) {
        this.log('info', `Reached limit of ${limit} products. Stopping scrape.`);
        break;
      }

      try {
        const scraped = await this.scrapeProductPage(url, scraperStatus);
        if (scraped) scrapedCount++;
      } catch (err) {
        this.log('error', `Error scraping product ${url}: ${err.message}`);
      }
    }

    this.log('success', `Finished Dutch Passion scraper. Scraped ${scrapedCount} products.`);
  }

  async scrapeProductPage(url, scraperStatus) {
    this.log('info', `Scraping product page: ${url}`);

    const res = await this.fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'de-DE,de;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Dutch Passion product page (status ${res.status})`);
    }

    const html = await res.text();

    const ldMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
    let productGroup = null;

    for (const m of ldMatches) {
      if (m[1].includes('ProductGroup')) {
        try {
          productGroup = JSON.parse(m[1]);
          break;
        } catch {}
      }
    }

    if (!productGroup) {
      throw new Error(`Could not parse ProductGroup LD+JSON from ${url}`);
    }

    const rawTitle = (productGroup.name || '').replace(/[®™]/g, '').trim();
    if (!rawTitle) {
      throw new Error(`Missing strain title on page: ${url}`);
    }

    const breeder = this.normalizeBreeder('Dutch Passion');
    const strainName = this.normalizeStrainName(rawTitle, breeder);
    const genetics = (productGroup.description || '').trim() || null;

    if (this.isInvalidStrainName(strainName, genetics || '')) {
      this.log('info', `Skipping invalid strain title or bundle: ${rawTitle}`);
      return;
    }

    scraperStatus.currentProduct = `${strainName} (${breeder})`;

    let seedType = 'feminized';
    let strainType = null;
    let thc = null;
    let floweringTime = null;

    if (productGroup.additionalProperty && Array.isArray(productGroup.additionalProperty)) {
      for (const p of productGroup.additionalProperty) {
        const pName = (p.name || '').toLowerCase();
        const pVal = (p.value || '').trim();

        if (pName.includes('samen typ')) {
          const valLower = pVal.toLowerCase();
          if (valLower.includes('auto')) seedType = 'autoflower';
          else if (valLower.includes('regul')) seedType = 'regular';
          else if (valLower.includes('feminisi')) seedType = 'feminized';
        } else if (pName.includes('effekt') || pName.includes('strain')) {
          strainType = pVal || null;
        } else if (pName.includes('thc')) {
          thc = pVal || null;
        } else if (pName.includes('blütezeit') || pName.includes('erntebereit')) {
          floweringTime = pVal || null;
        }
      }
    }

    // Fallback seedType check from title or URL
    const titleLower = rawTitle.toLowerCase();
    const urlLower = url.toLowerCase();
    if (titleLower.includes('auto') || urlLower.includes('auto-')) {
      seedType = 'autoflower';
    } else if (titleLower.includes('regul') || urlLower.includes('regular')) {
      seedType = 'regular';
    }

    const strainId = await this.upsertStrain({
      name: strainName,
      breeder: breeder,
      type: seedType,
      seedType: seedType,
      thc: thc,
      cbd: null,
      strainType: strainType,
      floweringTime: floweringTime,
      floweringMin: null,
      floweringMax: null,
      description: genetics,
      genetics: genetics
    });

    const variants = [];
    if (productGroup.hasVariant && Array.isArray(productGroup.hasVariant)) {
      for (const v of productGroup.hasVariant) {
        const sizeStr = v.size || v.name || '';
        const countMatch = sizeStr.match(/(\d+)\s*(?:Reguläre\s*)?Samen/i);
        const seeds = countMatch ? parseInt(countMatch[1], 10) : null;
        const price = v.offers?.price !== undefined ? parseFloat(v.offers.price) : null;
        const inStock = v.offers?.availability ? v.offers.availability.includes('InStock') : true;

        if (seeds && price && !isNaN(seeds) && !isNaN(price) && seeds > 0 && price > 0) {
          variants.push({ seeds, price, inStock });
        }
      }
    }

    if (variants.length === 0) {
      this.log('warning', `No valid seed variants found for strain "${strainName}" at ${url}`);
      return;
    }

    for (const v of variants) {
      await this.insertOffer({
        strainId,
        seeds: v.seeds,
        price: v.price,
        isAvailable: v.inStock,
        url: url
      });
    }

    scraperStatus.productsScraped++;
    this.log('success', `Saved strain "${strainName}" (${breeder}) with ${variants.length} offers.`);
    return true;
  }
}
