import { BaseScraper } from './BaseScraper.js';

export class HumboldtSeedCompanyScraper extends BaseScraper {
  constructor(logMessage, scrapeMode = 'price') {
    super('Humboldt Seed Company EU', logMessage, scrapeMode);
  }

  async scrape(scraperStatus, targetUrl = null) {
    this.log('info', 'Starting Humboldt Seed Company EU scraper...');
    scraperStatus.currentShop = this.shopName;

    const limit = this.getLimit();
    const productItemsMap = new Map(); // url -> { url, isCollective, catType, catSeedType }

    let categories = [
      { url: 'https://humboldtseedcompany.es/de/feminized-seeds/', isCollective: false, catType: 'photoperiodic', catSeedType: 'feminized' },
      { url: 'https://humboldtseedcompany.es/de/autoflower-seeds/', isCollective: false, catType: 'autoflower', catSeedType: 'feminized' },
      { url: 'https://humboldtseedcompany.es/de/triploid-seeds/', isCollective: false, catType: 'triploid', catSeedType: 'feminized' },
      { url: 'https://humboldtseedcompany.es/de/seed-collective/', isCollective: true, catType: null, catSeedType: null }
    ];

    if (targetUrl) {
      const urls = targetUrl.split(',').map(u => u.trim()).filter(Boolean);
      categories = urls.map(u => {
        const isCollective = u.includes('/seed-collective');
        let catType = 'photoperiodic';
        let catSeedType = 'feminized';

        if (u.includes('autoflower')) {
          catType = 'autoflower';
        } else if (u.includes('triploid')) {
          catType = 'triploid';
        }

        return { url: u, isCollective, catType: isCollective ? null : catType, catSeedType: isCollective ? null : catSeedType };
      });
    }

    for (const cat of categories) {
      if (limit !== null && productItemsMap.size >= limit) break;

      // If direct product URL passed
      if (cat.url.includes('/de/product/') || cat.url.includes('/product/')) {
        productItemsMap.set(cat.url, {
          url: cat.url,
          isCollective: cat.isCollective,
          catType: cat.catType,
          catSeedType: cat.catSeedType
        });
        continue;
      }

      this.log('info', `Crawling category index: ${cat.url}`);
      let page = 1;
      let keepCrawling = true;

      while (keepCrawling) {
        if (limit !== null && productItemsMap.size >= limit) break;

        const pageUrl = page > 1 
          ? (cat.url.endsWith('/') ? `${cat.url}page/${page}/` : `${cat.url}/page/${page}/`)
          : cat.url;

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
          this.log('warning', `Category page ${pageUrl} returned status ${res.status}. Stopping pagination for this category.`);
          break;
        }

        const html = await res.text();

        // Match product URLs: https://humboldtseedcompany.es/de/product/<slug>/
        const hrefMatches = [...html.matchAll(/href=["'](https:\/\/humboldtseedcompany\.es\/(?:de\/)?product\/[^"#?]+)["']/gi)];
        let newFoundOnPage = 0;

        for (const m of hrefMatches) {
          let u = m[1];
          // Ensure URL has /de/ prefix for German page
          if (!u.includes('/de/product/') && u.includes('/product/')) {
            u = u.replace('/product/', '/de/product/');
          }
          if (!u.endsWith('/')) u += '/';

          if (!productItemsMap.has(u)) {
            productItemsMap.set(u, {
              url: u,
              isCollective: cat.isCollective,
              catType: cat.catType,
              catSeedType: cat.catSeedType
            });
            newFoundOnPage++;
          }
        }

        this.log('info', `Page ${page} yielded ${newFoundOnPage} new product links (total queued: ${productItemsMap.size})`);

        if (newFoundOnPage === 0 || page >= 10) {
          keepCrawling = false;
        } else {
          page++;
        }
      }
    }

    this.log('info', `Queued ${productItemsMap.size} product URLs for parsing.`);

    let scrapedCount = 0;
    for (const [url, itemMeta] of productItemsMap) {
      if (limit !== null && scrapedCount >= limit) {
        this.log('info', `Reached limit of ${limit} products. Stopping scrape.`);
        break;
      }

      try {
        const scraped = await this.scrapeProductPage(url, itemMeta, scraperStatus);
        if (scraped) scrapedCount++;
      } catch (err) {
        this.log('error', `Error scraping product ${url}: ${err.message}`);
      }

      await this.sleep(400);
    }

    this.log('success', `Finished Humboldt Seed Company EU scraper. Scraped ${scrapedCount} products.`);
  }

  async scrapeProductPage(url, itemMeta = {}, scraperStatus = {}) {
    this.log('info', `Scraping product page: ${url}`);

    const res = await this.fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'de-DE,de;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch product page (status ${res.status}): ${url}`);
    }

    const html = await res.text();

    // Parse H1 title or JSON-LD name
    let rawTitle = null;
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      rawTitle = this.stripHtml(h1Match[1]).trim();
    }

    if (!rawTitle) {
      const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonLdMatches) {
        for (const m of jsonLdMatches) {
          try {
            const data = JSON.parse(m.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, ''));
            if (data['@type'] === 'Product' && data.name) {
              rawTitle = data.name;
              break;
            }
          } catch {}
        }
      }
    }

    if (!rawTitle) {
      throw new Error(`Could not parse strain title from ${url}`);
    }

    // Strip "Samen", "Semillas", "Seeds" suffix from title for clean matching
    rawTitle = rawTitle.replace(/\s+(Samen|Semillas|Seeds)\s*$/i, '').trim();

    if (this.isInvalidStrainName(rawTitle, html)) {
      this.log('info', `Skipping invalid/merchandise strain: ${rawTitle}`);
      return null;
    }

    // Determine Breeder
    let rawBreeder = 'Humboldt Seed Company';
    
    // Check if page comes from seed-collective or slug matches known third-party breeders
    const lowerUrl = url.toLowerCase();
    const isCollective = itemMeta.isCollective || lowerUrl.includes('seed-collective');

    if (isCollective || lowerUrl.includes('mendo-dope') || lowerUrl.includes('huckleberry-hill') || lowerUrl.includes('ridgeline-genetics')) {
      if (lowerUrl.includes('mendo-dope')) {
        rawBreeder = 'Mendo Dope Farms';
      } else if (lowerUrl.includes('huckleberry-hill')) {
        rawBreeder = 'Huckleberry Hill Farms';
      } else if (lowerUrl.includes('ridgeline-genetics')) {
        rawBreeder = 'Ridgeline Genetics';
      } else {
        // Try to parse breeder from title prefix
        const titleBreederMatch = rawTitle.match(/^(Mendo Dope|Huckleberry Hill|Ridgeline Genetics|Atlas Seed)\s*[-:]?\s*/i);
        if (titleBreederMatch) {
          rawBreeder = titleBreederMatch[1];
        } else {
          // Check JSON-LD brand
          const jsonLdBrand = html.match(/"brand"\s*:\s*{\s*"@type"\s*:\s*"Brand"\s*,\s*"name"\s*:\s*"([^"]+)"/i);
          if (jsonLdBrand && !jsonLdBrand[1].toLowerCase().includes('humboldt')) {
            rawBreeder = jsonLdBrand[1];
          }
        }
      }
    }

    const breeder = this.normalizeBreeder(rawBreeder);
    const strainName = this.normalizeStrainName(rawTitle, breeder);

    scraperStatus.currentProduct = `${strainName} (${breeder})`;

    // Determine strain type (autoflower, fast_flowering, triploid, photoperiodic)
    let type = itemMeta.catType;
    if (!type) {
      type = this.determineStrainType(rawTitle, html);
    }

    // Determine seedType (feminized, regular)
    let seedType = itemMeta.catSeedType || 'feminized';
    const lowerTitle = rawTitle.toLowerCase();
    if (lowerTitle.includes('regular') || lowerTitle.includes('regulär') || lowerUrl.includes('regular')) {
      seedType = 'regular';
    }

    // Parse specs from description container:
    // e.g. <p><strong>Typ:</strong> Indica-dominant<br /><strong>Abstammung:</strong> Humboldt OG x Humboldt Venom OG</p>
    let strainType = null;
    let genetics = null;
    let floweringTime = null;
    let thc = null;
    let cbd = null;
    let descriptionText = null;

    const descContainerMatch = html.match(/<div[^>]*class=["'][^"']*description-container[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                               html.match(/<div[^>]*class=["'][^"']*woocommerce-product-details__short-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (descContainerMatch) {
      const descHtml = descContainerMatch[1];
      descriptionText = this.stripHtml(descHtml);

      // Extract Typ / Type
      const typeMatch = descHtml.match(/<strong>\s*(?:Typ|Type)\s*:\s*<\/strong>\s*([^<]+)/i);
      if (typeMatch) {
        strainType = this.normalizeStrainType(typeMatch[1].trim());
      }

      // Extract Abstammung / Lineage / Genetics
      const geneticsMatch = descHtml.match(/<strong>\s*(?:Abstammung|Lineage|Genetics)\s*:\s*<\/strong>\s*([^<]+)/i);
      if (geneticsMatch) {
        genetics = geneticsMatch[1].trim();
      }

      // Extract Blütezeit / Flowering Time
      const floweringMatch = descHtml.match(/<strong>\s*(?:[–-]\s*)?(?:Blütezeit|Flowering\s*Time)\s*:\s*<\/strong>\s*([^<]+)/i) ||
                             descHtml.match(/<strong>\s*(?:[–-]\s*)?(?:Blütezeit|Flowering\s*Time)\s*:\s*([^<]+)<\/strong>/i);
      if (floweringMatch) {
        floweringTime = this.cleanFloweringTime(floweringMatch[1].trim());
      }

      // Extract THC
      const thcMatch = descHtml.match(/<strong>\s*THC\s*:\s*<\/strong>\s*([^<]+)/i);
      if (thcMatch) {
        thc = this.cleanThc(thcMatch[1].trim());
      }
    }

    // Fallbacks if specs weren't found in short description HTML
    if (!strainType) {
      strainType = this.normalizeStrainType(html);
    }
    if (!floweringTime) {
      const flMatch = html.match(/(?:Blütezeit|Flowering\s*Time):?\s*([0-9]+\s*(?:-\s*[0-9]+)?\s*(?:Tage|Days|Wochen|Weeks)?)/i);
      if (flMatch) {
        floweringTime = this.cleanFloweringTime(flMatch[1]);
      }
    }
    if (!thc) {
      const thcMatch = html.match(/THC:?\s*([0-9]+(?:\.[0-9]+)?\s*%\s*(?:-\s*[0-9]+(?:\.[0-9]+)?\s*%)?|[0-9]+\s*%)/i);
      if (thcMatch) {
        thc = this.cleanThc(thcMatch[1]);
      }
    }

    // Upsert strain in DB
    const strainId = await this.upsertStrain({
      name: strainName,
      breeder: breeder,
      type: type,
      seedType: seedType,
      thc: thc,
      cbd: cbd,
      strainType: strainType,
      floweringTime: floweringTime,
      floweringMin: null,
      floweringMax: null,
      description: descriptionText,
      genetics: genetics,
      url: url,
      rawTitle: rawTitle
    });

    const variants = [];

    // 1. Try WooCommerce variations JSON attribute
    const variationsMatch = html.match(/data-product_variations=["']([\s\S]*?)["']/i);
    if (variationsMatch) {
      try {
        const decoded = variationsMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
        const variationsData = JSON.parse(decoded);

        for (const v of variationsData) {
          const qtyAttr = v.attributes ? (v.attributes['attribute_pa_choose-quantity'] || v.attributes['attribute_pa_quantity'] || Object.values(v.attributes)[0] || '') : '';
          let seeds = this.parseSeedCount(qtyAttr);
          if (!seeds) {
            const seedM = qtyAttr.match(/pack-(\d+)-seeds/i) || qtyAttr.match(/(\d+)/);
            if (seedM) seeds = parseInt(seedM[1], 10);
          }
          if (!seeds && v.image && v.image.title) {
            seeds = this.parseSeedCount(v.image.title);
          }

          const price = v.display_price !== undefined ? parseFloat(v.display_price) : (v.display_regular_price !== undefined ? parseFloat(v.display_regular_price) : null);
          const availability = (v.is_in_stock && v.is_purchasable) ? 'available' : 'out_of_stock';

          if (seeds && price && !isNaN(price) && price > 0) {
            variants.push({ seeds, price, availability });
          }
        }
      } catch (e) {
        this.log('warning', `Could not parse data-product_variations JSON on ${url}: ${e.message}`);
      }
    }

    // 2. Fallback: Check h4/strong seed pack info (e.g. 10 Samen | 100,00 €)
    if (variants.length === 0) {
      const h4Match = html.match(/(\d+)\s*Samen\s*\|\s*([0-9]+(?:[,.][0-9]+)?)\s*€/i);
      if (h4Match) {
        const seeds = parseInt(h4Match[1], 10);
        const price = parseFloat(h4Match[2].replace(',', '.'));
        if (seeds && price && !isNaN(price) && price > 0) {
          variants.push({ seeds, price, availability: 'available' });
        }
      }
    }

    // 3. Fallback: JSON-LD offers
    if (variants.length === 0) {
      const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonLdMatches) {
        for (const m of jsonLdMatches) {
          try {
            const data = JSON.parse(m.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, ''));
            if (data['@type'] === 'Product' && data.offers) {
              const offers = Array.isArray(data.offers) ? data.offers : [data.offers];
              for (const offer of offers) {
                if (offer.price) {
                  const price = parseFloat(offer.price);
                  const seedsMatch = rawTitle.match(/(\d+)\s*(?:Samen|Seeds)/i) || html.match(/(\d+)\s*(?:Samen|Seeds)/i);
                  const seeds = seedsMatch ? parseInt(seedsMatch[1], 10) : 1;
                  if (price > 0) {
                    variants.push({ seeds, price, availability: 'available' });
                  }
                }
              }
            }
          } catch {}
        }
      }
    }

    if (variants.length === 0) {
      this.log('warning', `No valid seed pricing variants found for "${strainName}" at ${url}`);
      return null;
    }

    let offersCreated = 0;
    for (const v of variants) {
      await this.insertOffer({
        strainId,
        url,
        seeds: v.seeds,
        price: v.price,
        availability: v.availability
      });
      offersCreated++;
    }

    scraperStatus.productsScraped++;
    this.log('success', `Saved strain "${strainName}" (${breeder}) with ${offersCreated} offers.`);
    return {
      strainId,
      name: strainName,
      breeder,
      offersCreated
    };
  }

  async scrapeSingle(url) {
    this.log('info', `Running single page scrape for: ${url}`);
    const scraperStatus = { productsScraped: 0 };
    const res = await this.scrapeProductPage(url, {}, scraperStatus);
    if (!res) {
      throw new Error(`Failed to scrape Humboldt Seed Company EU product page at ${url}`);
    }
    return {
      ...res,
      shop: this.shopName
    };
  }
}
