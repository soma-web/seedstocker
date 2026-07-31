import { BaseScraper } from './BaseScraper.js';
import { db } from '../db.js';
import { strains } from '../schema.js';
import { and, sql } from 'drizzle-orm';

export class CannapotScraper extends BaseScraper {
  constructor(logMessage, scrapeMode = 'price') {
    super('Cannapot', logMessage, scrapeMode);
    this.baseUrl = 'https://www.cannapot.com';
  }

  async upsertStrain(strainData) {
    const name = (strainData.name || '').replace(/[’‘\`′]/g, "'").trim();
    const breeder = (strainData.breeder || '').replace(/[’‘\`′]/g, "'").trim();
    const cleanedSeedType = this.cleanSeedType(strainData.seedType);

    if (name && breeder && cleanedSeedType) {
      // Look up existing strain by name + breeder
      const [existingByNameBreeder] = await db.select()
        .from(strains)
        .where(and(
          sql`LOWER(TRIM(${strains.name})) = LOWER(TRIM(${name}))`,
          sql`LOWER(TRIM(${strains.breeder})) = LOWER(TRIM(${breeder}))`
        ))
        .limit(1);

      if (existingByNameBreeder) {
        const existingSeedType = this.cleanSeedType(existingByNameBreeder.seedType);
        // If DB strain has an explicit seedType (e.g. 'feminized') that conflicts with incoming seedType (e.g. 'regular')
        if (existingSeedType && existingSeedType !== cleanedSeedType) {
          if (this.scrapeMode === 'price') {
            this.log('info', `[price mode] Skipping Cannapot offer for seedType "${cleanedSeedType}" on "${name}" (${breeder}) — DB strain is "${existingSeedType}" (${existingByNameBreeder.id}).`);
            return null;
          }
        }
      }
    }

    return super.upsertStrain(strainData);
  }

  getHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cookie': 'language=de; currency=EUR'
    };
  }

  normalizeStrainName(title, breeder) {
    if (!title) return '';
    let name = title
      .trim()
      .replace(/\s+(?:female|fem|regular|reg|samen|seeds)\b/gi, '')
      .replace(/\[\s*\]/g, '')
      .trim();

    let result = super.normalizeStrainName(name, breeder);
    result = result
      .replace(/\s+(?:female|fem|regular|reg|samen|seeds)\b/gi, '')
      .replace(/\[\s*\]/g, '')
      .replace(/[\s\-_,.()\[\]]+$/, '')
      .trim();

    return result || name.replace(/\[\s*\]/g, '').replace(/[\s\-_,.()\[\]]+$/, '').trim();
  }

  extractSeedType(text = '') {
    const lower = text.toLowerCase();

    if (
      /\b(?:\d+\s*)?fem\.?\b/i.test(lower) ||
      /\bfeminisier/i.test(lower) ||
      /\bfeminized\b/i.test(lower) ||
      /\bfeminised\b/i.test(lower) ||
      /\bfemale\b/i.test(lower)
    ) {
      return 'feminized';
    }

    if (
      /\breg\.?\b/i.test(lower) ||
      /\bregular\b/i.test(lower) ||
      /\bregul[äa]r(?:e|en|er)?\b/i.test(lower) ||
      /\bregulaere\b/i.test(lower)
    ) {
      return 'regular';
    }

    return null;
  }

  isProductUrl(u) {
    if (!u) return false;
    const lower = u.toLowerCase();
    if (!lower.includes('/shop/hanfsamen/')) return false;
    if (!lower.endsWith('.html')) return false;
    const ignored = ['kontakt', 'konto', 'warenkorb', 'versand', 'empfohlene', 'agb', 'datenschutz', 'sitemap', 'impressum', 'canna-wiki', 'geschenkgutschein'];
    return !ignored.some(ig => lower.includes(ig));
  }

  extractGenetics(description = '', textContent = '', html = '') {
    const fullText = (description || '') + ' ' + textContent + ' ' + html;
    const zusamMatch = fullText.match(/Zusammensetzung:?\s*([^<>\n\r]+)/i);
    if (zusamMatch) {
      let rawGen = zusamMatch[1].replace(/<[^>]+>/g, '').trim();
      rawGen = rawGen.replace(/\.\s+[A-Z].*/, '').trim();
      if (rawGen) return rawGen;
    }

    const genMatch = fullText.match(/(?:Genetik|Kreuzung):?\s*([^.\n;<]+)/i);
    if (genMatch) {
      let rawGen = genMatch[1].replace(/<[^>]+>/g, '').trim();
      if (rawGen) return rawGen;
    }

    return null;
  }

  extractFloweringTime(description = '', textContent = '', html = '') {
    const fullText = (description || '') + ' ' + textContent + ' ' + html;
    const flowMatch = fullText.match(/(?:Blütezeit|Blütendauer|Flowering\s+time):?\s*([^<>\n\r.;]+)/i);
    if (flowMatch) {
      let rawVal = flowMatch[1].replace(/<[^>]+>/g, '').trim();
      if (rawVal) {
        return this.cleanFloweringTime(rawVal);
      }
    }
    return null;
  }

  extractThc(description = '', textContent = '', html = '') {
    const fullText = (description || '') + ' ' + textContent + ' ' + html;
    const thcMatch = fullText.match(/(?:THC-Gehalt|THC|THC-Content|Potenz):?\s*([^<>\n\r.;]+)/i);
    if (thcMatch) {
      let rawVal = thcMatch[1].replace(/<[^>]+>/g, '').trim();
      if (rawVal) {
        return this.cleanThc(rawVal);
      }
    }
    return null;
  }

  determineStrainTypeFromText(targetText = '') {
    const lower = (targetText || '').toLowerCase();
    const hasIndica = lower.includes('indica');
    const hasSativa = lower.includes('sativa');

    if (hasIndica && hasSativa) {
      return 'hybrid';
    } else if (hasIndica) {
      if (lower.includes('indica-domin') || lower.includes('indica domin') || lower.includes('indica-lastig')) {
        return 'indica-dominant';
      }
      return 'indica';
    } else if (hasSativa) {
      if (lower.includes('sativa-domin') || lower.includes('sativa domin') || lower.includes('sativa-lastig')) {
        return 'sativa-dominant';
      }
      return 'sativa';
    } else if (lower.includes('hybrid') || lower.includes('hybride')) {
      return 'hybrid';
    }

    return null;
  }

  determinePlantType(title = '', text = '', url = '') {
    const lower = `${title} ${text} ${url}`.toLowerCase();
    if (
      lower.includes('auto') ||
      lower.includes('automatic') ||
      lower.includes('automatisch') ||
      lower.includes('autoflower') ||
      lower.includes('autoflowering') ||
      lower.includes('lowryder')
    ) {
      return 'autoflower';
    }
    if (
      lower.includes('fast flowering') ||
      lower.includes('fast version') ||
      lower.includes('schnellblühend')
    ) {
      return 'fast_flowering';
    }
    return 'photoperiodic';
  }

  async scrape(scraperStatus, targetUrl = null) {
    this.log('info', 'Starting Cannapot scraper...');
    scraperStatus.currentShop = this.shopName;

    const limit = this.getLimit();
    const productPageMap = new Map(); // url => { type, seedType }

    if (targetUrl && this.isProductUrl(targetUrl)) {
      const urls = targetUrl.split(',').map(u => u.trim()).filter(Boolean);
      for (const u of urls) {
        if (this.isProductUrl(u)) {
          let type = 'photoperiodic';
          let seedType = 'feminized';
          const lower = u.toLowerCase();
          if (lower.includes('auto') || lower.includes('automatic')) type = 'autoflower';
          if (lower.includes('regular') || lower.includes('regulaer')) seedType = 'regular';
          productPageMap.set(u, { type, seedType });
        }
      }
    } else {
      this.log('info', 'Discovering product URLs from Cannapot category index...');

      const mainCategoryUrls = [
        `${this.baseUrl}/shop/hanfsamen?show=all`,
        `${this.baseUrl}/shop/hanfsamen/lowryder-samen?show=all`,
        `${this.baseUrl}/shop/hanfsamen/outdoor-hanfsamen?show=all`,
        `${this.baseUrl}/shop/hanfsamen/CBD-samen?show=all`,
        `${this.baseUrl}/shop/hanfsamen/regulaere-samen?show=all`,
        `${this.baseUrl}/shop/hanfsamen/neue-samen?show=all`,
        `${this.baseUrl}/shop/hanfsamen/sonderangebote?show=all`,
        `${this.baseUrl}/shop/hanfsamen/cannapot-seeds?show=all`
      ];

      // First fetch root category page to extract all breeder subcategories
      try {
        const rootRes = await this.fetchWithRetry(`${this.baseUrl}/shop/hanfsamen`, { headers: this.getHeaders() });
        if (rootRes && rootRes.ok) {
          const rootHtml = await rootRes.text();
          const hrefs = (rootHtml.match(/href=["'](https:\/\/www\.cannapot\.com\/shop\/hanfsamen\/[^"']+)["']/gi) || [])
            .map(m => m.replace(/^href=["']|["']$/g, ''));

          for (const h of hrefs) {
            if (!h.endsWith('.html') && !h.includes('?')) {
              const showAllUrl = h.includes('?') ? `${h}&show=all` : `${h}?show=all`;
              if (!mainCategoryUrls.includes(showAllUrl)) {
                mainCategoryUrls.push(showAllUrl);
              }
            }
          }
        }
      } catch (err) {
        this.log('warning', `Failed fetching root category for breeder discovery: ${err.message}`);
      }

      this.log('info', `Queued ${mainCategoryUrls.length} category listing pages for crawling.`);

      let processedCount = 0;
      for (const catUrl of mainCategoryUrls) {
        if (limit !== null && productPageMap.size >= limit) {
          this.log('info', `Reached max items limit (${limit}). Stopping category discovery.`);
          break;
        }

        try {
          const res = await this.fetchWithRetry(catUrl, { headers: this.getHeaders() });
          if (res && res.ok) {
            const html = await res.text();
            const hrefs = (html.match(/href=["'](https:\/\/www\.cannapot\.com\/shop\/hanfsamen\/[^"']+\.html)["']/gi) || [])
              .map(m => m.replace(/^href=["']|["']$/g, ''));

            for (const url of hrefs) {
              if (this.isProductUrl(url) && !productPageMap.has(url)) {
                let type = 'photoperiodic';
                let seedType = 'feminized';
                const lower = url.toLowerCase();
                if (lower.includes('auto') || lower.includes('automatic') || catUrl.includes('lowryder')) type = 'autoflower';
                if (lower.includes('regular') || lower.includes('regulaer') || catUrl.includes('regulaer')) seedType = 'regular';
                productPageMap.set(url, { type, seedType });
              }
            }
          }
        } catch (err) {
          this.log('warning', `Failed fetching category page ${catUrl}: ${err.message}`);
        }

        processedCount++;
        if (processedCount % 20 === 0 || processedCount === mainCategoryUrls.length) {
          this.log('info', `Category discovery progress: ${processedCount}/${mainCategoryUrls.length} categories scanned (${productPageMap.size} product URLs found so far).`);
        }

        await this.sleep(100);
      }
    }

    const productList = limit !== null
      ? Array.from(productPageMap.entries()).slice(0, limit)
      : Array.from(productPageMap.entries());

    this.log('info', `Total unique product pages queued for Cannapot: ${productList.length}`);

    await this.clearOffers();

    for (const [url, meta] of productList) {
      try {
        await this.scrapeSingle(url, meta, scraperStatus);
      } catch (err) {
        this.log('error', `Failed scraping page ${url}: ${err.message}`);
      }
      await this.sleep(300);
    }

    this.log('info', `Cannapot scraper finished successfully. Scraped ${scraperStatus.productsScraped} offers.`);
  }

  async scrapeSingle(url, meta = {}, scraperStatus = { productsScraped: 0 }) {
    this.log('info', `Running single page scrape for: ${url}`);

    let res;
    try {
      res = await this.fetchWithRetry(url, { headers: this.getHeaders() });
    } catch (err) {
      throw new Error(`Failed fetching page: ${err.message}`);
    }

    if (!res || !res.ok) {
      throw new Error(`Failed scraping page status ${res ? res.status : 'no-response'}`);
    }

    const html = await res.text();

    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&rsquo;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    const summaryText = textContent.split(/(?:BESCHREIBUNG|DETAILS|BEWERTUNGEN)/i)[0];

    // H1 Title
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (!h1Match) {
      throw new Error('Could not find H1 title on page');
    }

    const rawTitle = h1Match[1].replace(/<[^>]+>/g, '').trim();

    // Extract Breeder / Manufacturer
    let breeder = 'Unknown Breeder';
    const mfgMatch = html.match(/Hergestellt von:?[\s\S]*?<b>Hergestellt von:?<\/b>\s*([^<]+)/i) ||
                     html.match(/Hersteller:?<\/span>\s*&nbsp;\s*([^<]+)/i);
    if (mfgMatch) {
      const rawBreeder = mfgMatch[1].trim();
      breeder = this.normalizeBreeder(rawBreeder);
    }

    if (this.isInvalidStrainName(rawTitle, html, breeder)) {
      this.log('info', `Skipping invalid/merchandise product: ${rawTitle}`);
      return null;
    }

    scraperStatus.currentProduct = rawTitle;

    // Cleaned strain name
    let cleanTitle = rawTitle
      .replace(/\s+(?:female|fem|regular|reg|samen|seeds)\b/gi, '')
      .replace(/\[\s*\]/g, '')
      .trim();
    let strainName = this.normalizeStrainName(cleanTitle, breeder);
    if (!strainName) strainName = cleanTitle;

    // Base price parsing
    let basePrice = 0;
    const priceBlockMatch = html.match(/id=["']productPrices["'][\s\S]*?<\/h2>/i);
    if (priceBlockMatch) {
      const saleMatch = priceBlockMatch[0].match(/class=["'](?:productSpecialPrice|productSalePrice)["'][^>]*>\s*€\s*&nbsp;\s*([\d.,]+)/i);
      const normMatch = priceBlockMatch[0].match(/(?:class=["']normalprice["']|€\s*&nbsp;)\s*([\d.,]+)/i);
      if (saleMatch) {
        basePrice = parseFloat(saleMatch[1].replace(',', '.'));
      } else if (normMatch) {
        basePrice = parseFloat(normMatch[1].replace(',', '.'));
      }
    }

    // JSON-LD Description
    let description = null;
    const jsonLdMatch = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const data = JSON.parse(jsonLdMatch[1]);
        if (data.description) {
          description = data.description.replace(/&nbsp;/g, ' ').replace(/&rsquo;/g, "'").replace(/&amp;/g, '&');
        }
      } catch (e) {}
    }

    // Extract genetics, floweringTime, and THC from description / page text
    const genetics = this.extractGenetics(description, textContent, html);
    const floweringTime = this.extractFloweringTime(description, textContent, html);
    const thc = this.extractThc(description, textContent, html);

    // Taxonomy
    let type = meta.type || this.determinePlantType(rawTitle, (description || '') + ' ' + textContent, url);
    let seedType = meta.seedType || 'feminized';
    let cbd = null;

    const lowerText = (rawTitle + ' ' + (description || '') + ' ' + textContent + ' ' + url).toLowerCase();

    if (
      lowerText.includes('auto') ||
      lowerText.includes('automatic') ||
      lowerText.includes('automatisch') ||
      lowerText.includes('autoflower') ||
      lowerText.includes('autoflowering') ||
      lowerText.includes('lowryder')
    ) {
      type = 'autoflower';
    } else if (
      lowerText.includes('fast flowering') ||
      lowerText.includes('fast version') ||
      lowerText.includes('schnellblühend')
    ) {
      type = 'fast_flowering';
    }

    const explicitSeedType = this.extractSeedType(`${rawTitle} ${url}`) || meta.seedType;
    if (explicitSeedType) {
      seedType = explicitSeedType;
    } else if (/\b(?:regular|regul[äa]r|regulaere)\b/i.test(rawTitle) || url.toLowerCase().includes('/regulaere-samen/')) {
      seedType = 'regular';
    }

    const strainType = this.determineStrainTypeFromText(`${genetics || ''} ${description || ''} ${textContent} ${rawTitle}`);

    // Collect raw offers and detect per-option seedType (regular vs feminized)
    const rawOffers = [];
    const labelMatches = html.match(/<label\b[^>]*class=["'][^"']*attribsRadioButton[^"']*["'][\s\S]*?<\/label>/gi) || [];

    if (labelMatches.length > 0) {
      for (const lblHtml of labelMatches) {
        const labelText = lblHtml.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
        const seedsMatch = labelText.match(/^(\d+)/);
        const seeds = seedsMatch ? parseInt(seedsMatch[1], 10) : 1;

        const deltaMatch = labelText.match(/\(\s*([+-])?\s*€\s*([\d.,]+)\s*\)/i);
        let price = basePrice;
        if (deltaMatch) {
          const sign = deltaMatch[1] === '-' ? -1 : 1;
          const delta = sign * parseFloat(deltaMatch[2].replace(',', '.'));
          price = parseFloat((basePrice + delta).toFixed(2));
        }

        const offerSeedType = this.extractSeedType(labelText) || seedType;

        if (seeds > 0 && price > 0) {
          rawOffers.push({ seeds, price, seedType: offerSeedType });
        }
      }
    } else if (basePrice > 0) {
      const seedsMatch = rawTitle.match(/(\d+)\s*(?:stk|samen|seeds|pack)/i);
      const seeds = seedsMatch ? parseInt(seedsMatch[1], 10) : 1;
      rawOffers.push({ seeds, price: basePrice, seedType });
    }

    // Group rawOffers by seedType (e.g. 'feminized' vs 'regular')
    const groups = new Map(); // seedType => offerArray
    for (const off of rawOffers) {
      const sType = off.seedType || seedType || 'feminized';
      if (!groups.has(sType)) groups.set(sType, []);
      groups.get(sType).push(off);
    }

    let offersCreated = 0;
    let lastStrainId = null;
    // Create/upsert a separate strain entry for each distinct seedType option
    for (const [groupSeedType, offerGroup] of groups.entries()) {
      const groupStrainId = await this.upsertStrain({
        name: strainName,
        breeder,
        type,
        seedType: groupSeedType,
        thc,
        cbd,
        strainType,
        floweringTime,
        description,
        genetics,
        url,
        rawTitle
      });

      if (groupStrainId) {
        lastStrainId = groupStrainId;
        for (const off of offerGroup) {
          await this.insertOffer({
            strainId: groupStrainId,
            url,
            seeds: off.seeds,
            price: off.price,
            availability: 'available'
          });
          offersCreated++;
          scraperStatus.productsScraped++;
        }
      }
    }

    return {
      strainId: lastStrainId,
      name: strainName,
      breeder,
      offersCreated,
      shop: this.shopName
    };
  }

  parseOffersFromHtml(html) {
    const offers = [];

    let basePrice = 0;
    const priceBlockMatch = html.match(/id=["']productPrices["'][\s\S]*?<\/h2>/i);
    if (priceBlockMatch) {
      const saleMatch = priceBlockMatch[0].match(/class=["'](?:productSpecialPrice|productSalePrice)["'][^>]*>\s*€\s*&nbsp;\s*([\d.,]+)/i);
      const normMatch = priceBlockMatch[0].match(/(?:class=["']normalprice["']|€\s*&nbsp;)\s*([\d.,]+)/i);
      if (saleMatch) {
        basePrice = parseFloat(saleMatch[1].replace(',', '.'));
      } else if (normMatch) {
        basePrice = parseFloat(normMatch[1].replace(',', '.'));
      }
    }

    if (isNaN(basePrice)) basePrice = 0;

    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    const pageSeedType = this.extractSeedType(rawTitle) || 'feminized';

    const labelMatches = html.match(/<label\b[^>]*class=["'][^"']*attribsRadioButton[^"']*["'][\s\S]*?<\/label>/gi) || [];

    if (labelMatches.length > 0) {
      for (const lblHtml of labelMatches) {
        const labelText = lblHtml.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
        const seedsMatch = labelText.match(/^(\d+)/);
        const seeds = seedsMatch ? parseInt(seedsMatch[1], 10) : 1;

        const deltaMatch = labelText.match(/\(\s*([+-])?\s*€\s*([\d.,]+)\s*\)/i);
        let price = basePrice;
        if (deltaMatch) {
          const sign = deltaMatch[1] === '-' ? -1 : 1;
          const delta = sign * parseFloat(deltaMatch[2].replace(',', '.'));
          price = parseFloat((basePrice + delta).toFixed(2));
        }

        const offerSeedType = this.extractSeedType(labelText) || pageSeedType;

        if (seeds > 0 && price > 0) {
          offers.push({ seeds, price, seedType: offerSeedType });
        }
      }
    } else if (basePrice > 0) {
      const seedsMatch = rawTitle.match(/(\d+)\s*(?:stk|samen|seeds|pack)/i);
      const seeds = seedsMatch ? parseInt(seedsMatch[1], 10) : 1;
      const offerSeedType = this.extractSeedType(rawTitle) || pageSeedType;
      offers.push({ seeds, price: basePrice, seedType: offerSeedType });
    }

    return offers;
  }
}
