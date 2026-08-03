import { BaseScraper } from './BaseScraper.js';
import { db } from '../db.js';
import { strains } from '../schema.js';
import { and, sql } from 'drizzle-orm';

export class ZecretFlavorzScraper extends BaseScraper {
  constructor(logMessage, scrapeMode = 'price') {
    super('Zecret Flavorz', logMessage, scrapeMode);
    this.baseUrl = 'https://zecretflavorz.com';
    this.shopUrl = 'https://zecretflavorz.com/zecretshop/';
  }

  getHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    };
  }

  parseSeedCount(text) {
    if (!text) return null;
    const str = String(text).trim();

    // 1. Look for count inside parentheses e.g. "1 Pack (3 Seeds)" -> 3, "4 Pack (12 Seeds)" -> 12
    const parenMatch = str.match(/\(\s*(\d+)\s*(?:seeds|samen|stk|stück|stk\.)\s*\)/i);
    if (parenMatch) {
      const num = parseInt(parenMatch[1], 10);
      if (!isNaN(num) && num > 0) return num;
    }

    // 2. Direct seed count regex e.g. "10 REGULAR SEEDS", "3 Seeds", "12 Seeds", "1 Seed", "3 Samen"
    const directMatch = str.match(/(\d+)\s*(?:regular|reguläre|fem|feminized|feminisierte|automatic|auto)?\s*(?:seeds|samen|stk|stück|stk\.)\b/i);
    if (directMatch) {
      const num = parseInt(directMatch[1], 10);
      if (!isNaN(num) && num > 0) return num;
    }

    // 3. Promo format N+M e.g. "3+1"
    const promoMatch = str.match(/^(\d+)\s*\+/);
    if (promoMatch) {
      const num = parseInt(promoMatch[1], 10);
      if (!isNaN(num) && num > 0) return num;
    }

    // 4. Pack count pattern e.g. "1 Pack", "4 Pack" -> parse first number
    const packMatch = str.match(/(\d+)\s*(?:pack|pk)\b/i);
    if (packMatch) {
      const num = parseInt(packMatch[1], 10);
      if (!isNaN(num) && num > 0) return num;
    }

    // 5. Standalone number
    const numMatch = str.match(/\b(\d+)\b/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      if (!isNaN(num) && num > 0) return num;
    }

    return null;
  }

  isNonStrain(title, breeder = 'Zecret Flavorz') {
    if (!title) return true;
    const lower = String(title).trim().toLowerCase();
    if (/\b(?:cap|hoodie|t-shirt|tshirt|shirt|sweater|pullover|apparel|merch|clothing)\b/i.test(lower)) {
      return true;
    }
    return false;
  }

  cleanSeedType(rawType) {
    if (!rawType) return 'feminized';
    const str = String(rawType).toLowerCase();
    if (/\b(?:auto|automatic|autoflowering)\b/i.test(str)) {
      return 'autoflower';
    }
    if (/\b(?:regular|regulär)\b/i.test(str)) {
      return 'regular';
    }
    if (/\b(?:fem|feminized|feminisiert)\b/i.test(str)) {
      return 'feminized';
    }
    return 'feminized';
  }

  normalizeStrainName(title, breeder = 'Zecret Flavorz') {
    if (!title) return '';
    let name = title.trim();

    // Strip zecretflavorz prefix/suffix if present
    name = name.replace(/\s*-\s*Zecret\s*Flavorz\s*$/i, '');
    name = name.replace(/^Zecret\s*Flavorz\s*-\s*/i, '');

    // Strip seed format annotations from title
    name = name.replace(/\(\s*(?:AUTO|AUTOMATIC|REGULAR|REGULÄR|LTD|FEMINIZED)\s*\)/gi, '');
    name = name.replace(/\b(?:Feminized|Automatic|Regular)\s+Seeds\b/gi, '');
    name = name.replace(/\[\s*\]/g, '').trim();

    let result = super.normalizeStrainName(name, breeder || 'Zecret Flavorz');
    result = result
      .replace(/\(\s*(?:AUTO|AUTOMATIC|REGULAR|REGULÄR|LTD|FEMINIZED)\s*\)/gi, '')
      .replace(/\b(?:Feminized|Automatic|Regular)\s+Seeds\b/gi, '')
      .trim();

    // Convert ALL CAPS strain names to normal Title Case
    if (result && /[A-Z]/.test(result) && result === result.toUpperCase()) {
      result = result
        .toLowerCase()
        .replace(/(?:^|\s|-|\/|\()([a-z0-9])/g, (m) => m.toUpperCase())
        .replace(/\b(og|cbd|thc|24k|3d|v2|f1|ltd)\b/gi, (m) => m.toUpperCase())
        .replace(/\b([a-z])\b/gi, (m) => m.toUpperCase());
    }

    return result;
  }

  extractFloweringTime(cleanText, seedType) {
    if (!cleanText) return null;

    // Automatics rule: "A-Z Time: 9-11" -> flowering time (e.g. 9-11 weeks)
    const autoMatch = cleanText.match(/A-Z Time:\s*~?\s*([0-9\-\s\w]+?)(?:weeks|wochen|\.|,|Pack|$)/i);
    // Feminized rule: "Flowering: 9 Weeks" -> flowering time (e.g. 9 weeks)
    const femMatch = cleanText.match(/Flowering:\s*~?\s*([0-9\-\s\w]+?)(?:weeks|wochen|\.|,|Pack|$)/i);

    if (seedType === 'autoflower' && autoMatch) {
      const val = autoMatch[1].trim();
      return val.toLowerCase().includes('week') ? val : `${val} weeks`;
    }

    if (femMatch) {
      const val = femMatch[1].trim();
      return val.toLowerCase().includes('week') ? val : `${val} weeks`;
    }

    if (autoMatch) {
      const val = autoMatch[1].trim();
      return val.toLowerCase().includes('week') ? val : `${val} weeks`;
    }

    return null;
  }

  extractThcContent(cleanText) {
    if (!cleanText) return null;

    // Search under "Our THC Tests:"
    const thcSectionMatch = cleanText.match(/Our THC Tests:?\s*([\s\S]{0,150})/i);
    if (thcSectionMatch) {
      const pctMatch = thcSectionMatch[1].match(/([0-9]{2}(?:[\-\.][0-9]+)?\s*%)/);
      if (pctMatch) {
        return pctMatch[1].replace(/\s+/g, '');
      }
    }

    // Fallback: generic THC search
    const genericMatch = cleanText.match(/(?:THC|THC-Gehalt):?\s*([0-9]{2}(?:[\-\.][0-9]+)?\s*%)/i) ||
      cleanText.match(/([0-9]{2}(?:[\-\.][0-9]+)?\s*%)\s*THC/i) ||
      cleanText.match(/up to\s+([0-9]{2}(?:[\-\.][0-9]+)?\s*%)/i);

    if (genericMatch) {
      return genericMatch[1].replace(/\s+/g, '');
    }

    return null;
  }

  parseOffersFromHtml(html, url = '') {
    if (!html) return [];
    const offers = [];

    // 1. Try WooCommerce data-product_variations attribute
    const varMatch = html.match(/data-product_variations="([^"]+)"/);
    if (varMatch) {
      try {
        const decoded = varMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const v of parsed) {
            const attrVal = Object.values(v.attributes || {})[0] || v.variation_description || '';
            const seeds = this.parseSeedCount(attrVal) || this.parseSeedCount(v.sku) || 1;
            const priceVal = v.display_price !== undefined ? v.display_price : v.display_regular_price;
            const price = parseFloat(priceVal);

            if (!isNaN(price) && price > 0) {
              const isAvailable = v.is_in_stock !== false && v.variation_is_active !== false;
              offers.push({
                seeds,
                price,
                availability: isAvailable ? 'available' : 'out_of_stock',
                variantTitle: attrVal
              });
            }
          }
          if (offers.length > 0) return offers;
        }
      } catch (e) {
        this.log('warning', `Failed to parse data-product_variations for ${url}: ${e.message}`);
      }
    }

    // 2. Try select dropdown option elements in HTML
    const selectMatch = html.match(/<select[^>]*name=["']attribute_[^"']*["'][^>]*>([\s\S]*?)<\/select>/i);
    if (selectMatch) {
      const optionMatches = selectMatch[1].matchAll(/<option[^>]*value=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi);
      for (const opt of optionMatches) {
        const optText = opt[2].replace(/<[^>]+>/g, '').trim();
        if (!optText || optText.toLowerCase().includes('choose an option')) continue;
        const seeds = this.parseSeedCount(optText) || 1;
        // Search price in option text if present e.g. "1 Pack - €39.00"
        const priceMatch = optText.match(/[\d.,]+/);
        if (priceMatch) {
          const price = parseFloat(priceMatch[0].replace(/\./g, '').replace(',', '.'));
          if (!isNaN(price) && price > 0) {
            offers.push({
              seeds,
              price,
              availability: 'available'
            });
          }
        }
      }
      if (offers.length > 0) return offers;
    }

    // 3. Simple Product Fallback (No variation options)
    const priceMatch = html.match(/<span class="woocommerce-Price-amount amount"><bdi>([\d.,]+)/i) ||
      html.match(/<p class="price">[\s\S]*?([\d.,]+)\s*&euro;/i);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'));
      if (!isNaN(price) && price > 0) {
        const isOutOfStock = html.includes('out-of-stock') || html.includes('Ausverkauft');
        const cleanText = html.replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ');
        const seeds = this.parseSeedCount(cleanText) || 1;
        offers.push({
          seeds,
          price,
          availability: isOutOfStock ? 'out_of_stock' : 'available'
        });
      }
    }

    return offers;
  }

  async fetchProductUrls() {
    const productUrls = new Set();
    let page = 1;
    const limit = this.getLimit();

    while (true) {
      const pageUrl = page === 1 ? this.shopUrl : `${this.shopUrl}page/${page}/`;
      this.log('info', `Fetching shop page ${page}: ${pageUrl}`);

      try {
        const res = await fetch(pageUrl, { headers: this.getHeaders() });
        if (res.status === 404) {
          this.log('info', `Page ${page} returned 404, ending shop pagination.`);
          break;
        }

        if (!res.ok) {
          this.log('warning', `Failed to fetch shop page ${pageUrl}: HTTP ${res.status}`);
          break;
        }

        const html = await res.text();
        const matches = Array.from(html.matchAll(/href=["'](https?:\/\/zecretflavorz\.com\/produkt\/[^"']+)["']/g));
        const foundOnPage = matches.map(m => m[1]);

        if (foundOnPage.length === 0) {
          this.log('info', `No product links found on page ${page}, stopping.`);
          break;
        }

        let addedCount = 0;
        for (const url of foundOnPage) {
          // Clean hash/query
          const cleanUrl = url.split('#')[0].split('?')[0];
          if (!productUrls.has(cleanUrl)) {
            productUrls.add(cleanUrl);
            addedCount++;
            if (limit && productUrls.size >= limit) {
              this.log('info', `Reached limit of ${limit} products.`);
              return Array.from(productUrls);
            }
          }
        }

        if (addedCount === 0) {
          this.log('info', `No new product links found on page ${page}, stopping.`);
          break;
        }

        page++;
      } catch (err) {
        this.log('error', `Error fetching shop page ${pageUrl}: ${err.message}`);
        break;
      }
    }

    return Array.from(productUrls);
  }

  async parseProductPage(url) {
    try {
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) {
        this.log('warning', `Failed to fetch product page ${url}: HTTP ${res.status}`);
        return null;
      }

      const html = await res.text();

      // Title & H1 extraction
      const titleTag = html.match(/<title>(.*?)<\/title>/i)?.[1] || '';
      const h1Match = html.match(/<h1[^>]*class="[^"]*product_title[^"]*"[^>]*>(.*?)<\/h1>/i) ||
        html.match(/<h1[^>]*>(.*?)<\/h1>/i);
      const rawTitle = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : titleTag.split('-')[0].trim();

      if (!rawTitle) {
        this.log('warning', `Could not extract product title from ${url}`);
        return null;
      }

      const breeder = 'Zecret Flavorz';
      if (this.isNonStrain(rawTitle, breeder)) {
        this.log('info', `Skipping non-strain product "${rawTitle}" (${url})`);
        return null;
      }

      const cleanText = html.replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ');

      const seedType = this.cleanSeedType(`${rawTitle} ${titleTag}`);
      const normalizedName = this.normalizeStrainName(rawTitle, breeder);
      const flowering = this.extractFloweringTime(cleanText, seedType);
      const thc = this.extractThcContent(cleanText);

      // Description text
      const descMatch = html.match(/<div[^>]*class="[^"]*woocommerce-product-details__short-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
        html.match(/<div[^>]*id="tab-description"[^>]*>([\s\S]*?)<\/div>/i) ||
        html.match(/<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';

      // Offers
      const offers = this.parseOffersFromHtml(html, url);

      return {
        url,
        rawTitle,
        normalizedName,
        breeder,
        seedType,
        flowering,
        thc,
        description,
        offers
      };
    } catch (err) {
      this.log('error', `Error parsing product page ${url}: ${err.message}`);
      return null;
    }
  }

  async scrape() {
    this.log('info', `Starting Zecret Flavorz scrape (Mode: ${this.scrapeMode})...`);

    const productUrls = await this.fetchProductUrls();
    this.log('info', `Found ${productUrls.length} total product URLs to process.`);

    let processedCount = 0;
    let errorCount = 0;

    for (const url of productUrls) {
      const product = await this.parseProductPage(url);
      if (!product) {
        errorCount++;
        continue;
      }

      if (!product.offers || product.offers.length === 0) {
        this.log('warning', `No offers parsed for product ${product.normalizedName} (${url})`);
        continue;
      }

      try {
        const strainData = {
          name: product.normalizedName,
          breeder: product.breeder,
          seedType: product.seedType,
          flowering: product.flowering,
          thc: product.thc
        };

        const strainId = await this.upsertStrain(strainData);
        if (!strainId) {
          continue;
        }

        // Description handling
        if (product.description) {
          await this.saveShopDescription(strainId, product.description);
        }

        // Upsert offers & price history
        for (const offer of product.offers) {
          await this.upsertOffer({
            strainId,
            seeds: offer.seeds,
            price: offer.price,
            url: product.url,
            availability: offer.availability
          });
        }

        processedCount++;
      } catch (err) {
        this.log('error', `Error processing strain "${product.normalizedName}": ${err.message}`);
        errorCount++;
      }
    }

    this.log('info', `Finished Zecret Flavorz scrape. Processed: ${processedCount}, Errors: ${errorCount}`);
  }
}
