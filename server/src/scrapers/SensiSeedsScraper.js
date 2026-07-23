import { BaseScraper } from './BaseScraper.js';

function decodeHTMLEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#x2B;/gi, '+')
    .replace(/&#x20AC;/gi, '€')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export class SensiSeedsScraper extends BaseScraper {
  constructor(logMessage, scrapeMode = 'price') {
    super('Sensi Seeds', logMessage, scrapeMode);
  }

  normalizeBreeder(breeder) {
    if (!breeder) return 'Unknown Breeder';
    const clean = breeder.trim().toLowerCase();
    if (clean === 'research' || clean === 'sensi seeds research') {
      return 'Sensi Seeds';
    }
    return super.normalizeBreeder(breeder);
  }

  normalizeStrainName(title, breeder) {
    let name = super.normalizeStrainName(title, breeder);
    // Remove trailing loose "e" or " e" (e.g. from incomplete regex replacements of "reguläre")
    name = name.replace(/\b[eE]\b$/, '').trim();
    // Clean up any remaining trailing punctuation/whitespace
    name = name.replace(/^[\s\-_,.]+/, '').replace(/[\s\-_,.()]+$/, '').trim();
    return name;
  }

  normalizeFloweringTime(val) {
    if (!val) return null;
    const str = val.trim().toLowerCase();
    if (str.includes('durchschnittliche blütezeit')) {
      return '8-9';
    }
    if (str.includes('kurze blütezeit')) {
      return '7-8';
    }
    if (str.includes('extralange blütezeit')) {
      return '11-13';
    }
    if (str.includes('lange blütezeit')) {
      return '9-11';
    }
    return val.trim();
  }

  async scrape(scraperStatus, targetUrl = null) {
    this.log('info', 'Starting Sensi Seeds scraper...');
    scraperStatus.currentShop = this.shopName;
    

    const limit = this.getLimit();
    const productUrls = new Set();
    const baseCategoryUrl = 'https://sensiseeds.com/de/hanfsamen';
    
    let categoryUrls = [baseCategoryUrl];
    if (targetUrl) {
      categoryUrls = targetUrl.split(',').map(u => u.trim()).filter(Boolean);
    }
    
    for (const catUrl of categoryUrls) {
      if (limit !== null && productUrls.size >= limit) break;
      
      // If single product URL directly provided
      if (catUrl.includes('/de/') && !catUrl.includes('hanfsamen') && !catUrl.includes('pagenumber=')) {
        productUrls.add(catUrl);
        continue;
      }
      
      this.log('info', `Crawling category index: ${catUrl}`);
      let page = 1;
      let keepCrawling = true;
      
      while (keepCrawling) {
        if (limit !== null && productUrls.size >= limit) break;
        
        const pageUrl = catUrl.includes('?') ? `${catUrl}&pagenumber=${page}` : `${catUrl}?pagenumber=${page}`;
        this.log('info', `Fetching category page: ${pageUrl}`);
        
        let res;
        try {
          res = await this.fetchWithRetry(pageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept-Language': 'de-DE,de;q=0.9'
            }
          });
        } catch (err) {
          this.log('error', `Failed fetching category page ${pageUrl}: ${err.message}`);
          break;
        }
        
        if (!res.ok) {
          this.log('warning', `Category page ${pageUrl} returned status ${res.status}. Stopping pagination for this URL.`);
          break;
        }
        
        const html = await res.text();
        const itemBoxes = html.split(/<div class="product-item"|<div class="item-box"/i).slice(1);
        
        let newFoundOnPage = 0;
        for (const box of itemBoxes) {
          if (limit !== null && productUrls.size >= limit) break;
          
          const hrefMatch = box.match(/href="(\/de\/[^"]+)"/);
          if (hrefMatch) {
            const path = hrefMatch[1];
            if (
              !path.includes('shoppingcart') &&
              !path.includes('wishlist') &&
              !path.includes('account') &&
              !path.includes('login') &&
              !path.includes('register') &&
              !path.includes('pagenumber=')
            ) {
              const fullUrl = path.startsWith('http') ? path : `https://sensiseeds.com${path}`;
              if (!productUrls.has(fullUrl)) {
                productUrls.add(fullUrl);
                newFoundOnPage++;
              }
            }
          }
        }
        
        this.log('info', `Page ${page} yielded ${newFoundOnPage} product links (total queued: ${productUrls.size})`);
        if (newFoundOnPage === 0) {
          keepCrawling = false;
        } else {
          page++;
        }
      }
    }
    
    this.log('info', `Queued ${productUrls.size} product URLs for parsing.`);
    
    for (const url of productUrls) {
      try {
        await this.scrapeProductPage(url, scraperStatus);
      } catch (err) {
        this.log('error', `Error scraping product ${url}: ${err.message}`);
      }
    }
    
    this.log('success', `Finished Sensi Seeds scraper. Scraped ${scraperStatus.productsScraped} total products.`);
  }

  async scrapeProductPage(url, scraperStatus) {
    this.log('info', `Scraping product page: ${url}`);
    
    const res = await this.fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'de-DE,de;q=0.9'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Sensi Seeds product page (status ${res.status})`);
    }

    const html = await res.text();

    // 1. Parse JS kViewProduct if available
    const kViewMatch = html.match(/const kViewProduct\s*=\s*(\{[\s\S]*?\});/);
    let kViewData = null;
    if (kViewMatch) {
      try {
        kViewData = eval('(' + kViewMatch[1] + ')');
      } catch {}
    }

    // 2. Title and Genetics
    const h1TitleRaw = html.match(/<h1[^>]*class="[^"]*product-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.trim() || kViewData?.ProductName || '';
    if (!h1TitleRaw) {
      throw new Error('Could not parse strain title from Sensi Seeds page.');
    }

    const rawTitle = decodeHTMLEntities(h1TitleRaw.replace(/<[^>]+>/g, '')).trim();
    const geneticsRaw = html.match(/<p[^>]*class="[^"]*product-title-small[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1]?.trim() || '';
    const genetics = decodeHTMLEntities(geneticsRaw.replace(/<[^>]+>/g, '')).trim();

    // 3. Extract attributes table/grid (Key-Value)
    const attributes = {};
    const attrMatches = [...html.matchAll(/<div[^>]*class="[^"]*product-attribute-name[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*product-attribute-value[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
    for (const m of attrMatches) {
      const key = decodeHTMLEntities(m[1].replace(/<[^>]+>/g, '').trim()).toLowerCase();
      const val = decodeHTMLEntities(m[2].replace(/<[^>]+>/g, '').trim());
      attributes[key] = val;
    }

    // 4. Breeder Normalization
    const rawBreeder = attributes['samenbank'] || kViewData?.Brand || 'Sensi Seeds';
    const breeder = this.normalizeBreeder(rawBreeder);

    // 5. Strain Name Normalization
    const cleanTitle = rawTitle
      .replace(/\bvon\s+.*$/i, '')
      .replace(/\bby\s+.*$/i, '')
      .replace(/\bhanfsamen\b/gi, '')
      .replace(/\bcannabissamen\b/gi, '')
      .replace(/\bsamen\b/gi, '')
      .trim();

    const strainName = this.normalizeStrainName(cleanTitle, breeder);

    // Description extraction
    const descMatch = html.match(/<div[^>]*class="[^"]*full-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    let description = '';
    if (descMatch) {
      description = decodeHTMLEntities(descMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    }

    if (this.isInvalidStrainName(strainName, description)) {
      this.log('info', `Skipping invalid strain title or bundle: ${rawTitle}`);
      return;
    }

    scraperStatus.currentProduct = `${strainName} (${breeder})`;

    // 6. Seed Type & Strain Type
    const samenTyp = (attributes['samen typ'] || '').toLowerCase();
    
    let seedType = 'feminized';
    if (samenTyp.includes('regulär') || rawTitle.toLowerCase().includes('regular') || url.toLowerCase().includes('regulare')) {
      seedType = 'regular';
    }

    const type = this.determineStrainType(rawTitle, samenTyp + ' ' + url);

    const strainType = attributes['sativa / indica'] || null;
    const floweringTime = this.normalizeFloweringTime(attributes['blütezeit'] || null);

    // 7. Upsert Strain into DB
    const strainId = await this.upsertStrain({
      name: strainName,
      breeder,
      type,
      seedType,
      strainType,
      floweringTime,
      genetics,
      description,
      url,
      rawTitle
    });

    // 8. Extract Offers (Pack Sizes & Prices)
    const labelMatches = [...html.matchAll(/<label[^>]*for="product_attribute_[^"]*"[^>]*>([\s\S]*?)<\/label>/gi)];
    let savedOffersCount = 0;

    for (const lm of labelMatches) {
      const decodedLabel = decodeHTMLEntities(lm[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      const seedsMatch = decodedLabel.match(/(\d+)(?:\s*\+\s*\d+)?\s*samen/i);
      const priceMatch = decodedLabel.match(/(?:€\s*([\d.,]+)|([\d.,]+)\s*€)/);
      
      if (seedsMatch && priceMatch) {
        const seeds = parseInt(seedsMatch[1], 10);
        const priceRaw = priceMatch[1] || priceMatch[2];
        const price = parseFloat(priceRaw.replace('.', '').replace(',', '.'));
        
        if (!isNaN(seeds) && !isNaN(price) && seeds > 0 && price > 0) {
          await this.insertOffer({
            strainId,
            url,
            seeds,
            price,
            currency: 'EUR',
            availability: 'available'
          });
          savedOffersCount++;
        }
      }
    }

    if (savedOffersCount > 0) {
      scraperStatus.productsScraped++;
      this.log('info', `Saved strain "${strainName}" (${breeder}) with ${savedOffersCount} price offer(s).`);
    } else {
      this.log('warning', `Strain "${strainName}" parsed, but no valid price options found on ${url}`);
    }

    // Save description if full mode
    if (description && (this.scrapeMode === 'full' || this.scrapeMode === 'all')) {
      await this.upsertShopDescription(strainId, this.shopName, description);
    }
  }

  async scrapeSingle(url) {
    this.log('info', `Running single page scrape for: ${url}`);
    
    const res = await this.fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'de-DE,de;q=0.9'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Sensi Seeds product page (status ${res.status})`);
    }

    const html = await res.text();

    const kViewMatch = html.match(/const kViewProduct\s*=\s*(\{[\s\S]*?\});/);
    let kViewData = null;
    if (kViewMatch) {
      try {
        kViewData = eval('(' + kViewMatch[1] + ')');
      } catch {}
    }

    const h1TitleRaw = html.match(/<h1[^>]*class="[^"]*product-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.trim() || kViewData?.ProductName || '';
    if (!h1TitleRaw) {
      throw new Error('Could not parse strain title from Sensi Seeds page.');
    }

    const rawTitle = decodeHTMLEntities(h1TitleRaw.replace(/<[^>]+>/g, '')).trim();
    const geneticsRaw = html.match(/<p[^>]*class="[^"]*product-title-small[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1]?.trim() || '';
    const genetics = decodeHTMLEntities(geneticsRaw.replace(/<[^>]+>/g, '')).trim();

    const attributes = {};
    const attrMatches = [...html.matchAll(/<div[^>]*class="[^"]*product-attribute-name[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*product-attribute-value[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
    for (const m of attrMatches) {
      const key = decodeHTMLEntities(m[1].replace(/<[^>]+>/g, '').trim()).toLowerCase();
      const val = decodeHTMLEntities(m[2].replace(/<[^>]+>/g, '').trim());
      attributes[key] = val;
    }

    const rawBreeder = attributes['samenbank'] || kViewData?.Brand || 'Sensi Seeds';
    const breeder = this.normalizeBreeder(rawBreeder);

    const cleanTitle = rawTitle
      .replace(/\bvon\s+.*$/i, '')
      .replace(/\bby\s+.*$/i, '')
      .replace(/\bhanfsamen\b/gi, '')
      .replace(/\bcannabissamen\b/gi, '')
      .replace(/\bsamen\b/gi, '')
      .trim();

    const strainName = this.normalizeStrainName(cleanTitle, breeder);

    const descMatch = html.match(/<div[^>]*class="[^"]*full-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    let description = '';
    if (descMatch) {
      description = decodeHTMLEntities(descMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    }

    if (this.isInvalidStrainName(strainName, description)) {
      throw new Error(`Skipping invalid strain title or bundle: ${rawTitle}`);
    }

    const samenTyp = (attributes['samen typ'] || '').toLowerCase();
    
    let seedType = 'feminized';
    if (samenTyp.includes('regulär') || rawTitle.toLowerCase().includes('regular') || url.toLowerCase().includes('regulare')) {
      seedType = 'regular';
    }

    const type = this.determineStrainType(rawTitle, samenTyp + ' ' + url);

    const strainType = attributes['sativa / indica'] || null;
    const floweringTime = this.normalizeFloweringTime(attributes['blütezeit'] || null);

    const strainId = await this.upsertStrain({
      name: strainName,
      breeder,
      type,
      seedType,
      strainType,
      floweringTime,
      genetics,
      description,
      url,
      rawTitle
    });

    const labelMatches = [...html.matchAll(/<label[^>]*for="product_attribute_[^"]*"[^>]*>([\s\S]*?)<\/label>/gi)];
    let offersCreated = 0;

    for (const lm of labelMatches) {
      const decodedLabel = decodeHTMLEntities(lm[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      const seedsMatch = decodedLabel.match(/(\d+)(?:\s*\+\s*\d+)?\s*samen/i);
      const priceMatch = decodedLabel.match(/(?:€\s*([\d.,]+)|([\d.,]+)\s*€)/);
      
      if (seedsMatch && priceMatch) {
        const seeds = parseInt(seedsMatch[1], 10);
        const priceRaw = priceMatch[1] || priceMatch[2];
        const price = parseFloat(priceRaw.replace('.', '').replace(',', '.'));
        
        if (!isNaN(seeds) && !isNaN(price) && seeds > 0 && price > 0) {
          await this.insertOffer({
            strainId,
            url,
            seeds,
            price,
            currency: 'EUR',
            availability: 'available'
          });
          offersCreated++;
        }
      }
    }

    if (description) {
      await this.upsertShopDescription(strainId, this.shopName, description);
    }

    return {
      strainId,
      name: strainName,
      breeder,
      offersCreated,
      shop: this.shopName
    };
  }
}
