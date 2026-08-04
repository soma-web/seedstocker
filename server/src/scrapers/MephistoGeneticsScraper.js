import { ShopifyScraper } from './ShopifyScraper.js';

export class MephistoGeneticsScraper extends ShopifyScraper {
  constructor(logMessage, scrapeMode = 'price') {
    super('Mephisto Genetics', logMessage, scrapeMode);
    this.baseUrl = 'https://mephistogenetics.com';
    this.shopUrl = 'https://mephistogenetics.com/';
  }

  isNonStrain(title, bodyHtml = '', tags = []) {
    if (!title) return true;
    const lowerTitle = String(title).trim().toLowerCase();
    const lowerBody = String(bodyHtml || '').toLowerCase();
    const tagsLower = Array.isArray(tags) ? tags.map(t => String(t).toLowerCase()) : [];

    // Exclude retired and archived strains
    if (
      tagsLower.includes('retired') ||
      tagsLower.some(t => t.includes('archive')) ||
      lowerTitle.includes('retired') ||
      lowerTitle.includes('archived')
    ) {
      return true;
    }

    // Exclude bundles per explicit requirement (https://mephistogenetics.com/pages/bundles)
    if (
      lowerTitle.includes('bundle') ||
      lowerBody.includes('/pages/bundles') ||
      tagsLower.some(t => t.includes('bundle'))
    ) {
      return true;
    }

    // Exclude non-seed merchandise, swag, stickers, etc.
    const nonSeedKeywords = [
      'gift card', 'protection', 'grove bag', 'grove bags', 'bag', 'bags',
      'apparel', 'merch', 'swag', 'badge', 'badges', 'shirt', 'hoodie',
      'cap', 'sticker', 'stickers', 'plant tag', 'plant tags', 'pin badges',
      'slap', 'keyring', 'poster'
    ];

    for (const kw of nonSeedKeywords) {
      const regex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lowerTitle) || tagsLower.some(t => regex.test(t))) {
        return true;
      }
    }

    return false;
  }

  isInvalidStrainName(title, description = '', breeder = '') {
    if (this.isNonStrain(title, description)) {
      return true;
    }
    return super.isInvalidStrainName(title, description, breeder);
  }

  parseSeedCount(text) {
    if (!text) return null;
    const str = String(text).trim();
    const lower = str.toLowerCase();

    // Ignore non-seed variant titles (stickers, bags, merch, bundles)
    if (/\b(?:sticker|stickers|patch|bag|bags|bundle|bundles|gift card|protection|apparel|merch|swag|badge|badges|shirt|hoodie|cap)\b/i.test(lower)) {
      return null;
    }

    // Explicitly require seed/samen/stk/stück keyword in title
    const match = str.match(/(?:b2b\s+)?(\d+)\s*(?:\(\+\d+\))?\s*(?:seeds?|samen|stk|stück)\b/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0 && num <= 1000) {
        return num;
      }
    }
    return null;
  }

  parseShopifySpecs(bodyHtml = '', tags = [], html = '') {
    const specs = {
      thc: null,
      cbd: null,
      strainType: null,
      floweringTime: null,
      genetics: null
    };

    const combinedText = `${bodyHtml || ''} ${html || ''}`;
    const cleanCombined = combinedText.replace(/<[^>]+>/g, ' ');
    const tagsLower = Array.isArray(tags) ? tags.map(t => String(t).toLowerCase()) : [];

    // 1. Extract Cannabinoids (THC / CBD)
    // DOM pattern: Cannabinoids</div> <div...>15% THC</div>
    const canDomMatch = combinedText.match(/Cannabinoids<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
    let rawCannabinoids = canDomMatch ? canDomMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    if (!rawCannabinoids) {
      const canTxtMatch = cleanCombined.match(/Cannabinoids[:\s]+([^\n<]+)/i);
      if (canTxtMatch) rawCannabinoids = canTxtMatch[1].trim();
    }

    if (rawCannabinoids) {
      const thcM = rawCannabinoids.match(/(\d+[-.]?\d*\s*%\s*THC|\d+[-.]?\d*\s*%)/i);
      if (thcM) specs.thc = thcM[0].trim();

      const cbdM = rawCannabinoids.match(/(\d+[-.]?\d*\s*%\s*CBD|CBD[:\s]*\d+[-.]?\d*\s*%\s*CBD|1:1\s*CBD)/i);
      if (cbdM) specs.cbd = cbdM[0].trim();

      if (!specs.thc && !specs.cbd && rawCannabinoids.length <= 30) {
        specs.thc = rawCannabinoids;
      }
    }

    if (!specs.thc) {
      const thcMatch = cleanCombined.match(/(\d+[-.]?\d*\s*%\s*THC|THC[:\s]*\d+[-.]?\d*\s*%)/i);
      if (thcMatch) specs.thc = thcMatch[0].trim();
    }

    if (!specs.cbd) {
      const cbdMatch = cleanCombined.match(/(\d+[-.]?\d*\s*%\s*CBD|CBD[:\s]*\d+[-.]?\d*\s*%|1:1\s*CBD)/i);
      if (cbdMatch) specs.cbd = cbdMatch[0].trim();
    }

    // 2. Extract Indica/Sativa (Strain Type)
    // DOM pattern: Indica/Sativa</div> <div...>35/65</div>
    const indDomMatch = combinedText.match(/Indica\/Sativa<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
    let rawIndicaSativa = indDomMatch ? indDomMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    if (!rawIndicaSativa) {
      const indTxtMatch = cleanCombined.match(/Indica\/Sativa[:\s]+([^\n<]+)/i);
      if (indTxtMatch) rawIndicaSativa = indTxtMatch[1].trim();
    }

    if (tagsLower.includes('msindica')) {
      specs.strainType = 'Indica-dominant';
    } else if (tagsLower.includes('mssativa')) {
      specs.strainType = 'Sativa-dominant';
    } else if (tagsLower.includes('mshybrid')) {
      specs.strainType = 'Hybrid';
    }

    if (!specs.strainType && rawIndicaSativa) {
      const ratioM = rawIndicaSativa.match(/(\d{1,2})\s*[\/:]\s*(\d{1,2})/);
      if (ratioM) {
        const num1 = parseInt(ratioM[1], 10);
        const num2 = parseInt(ratioM[2], 10);
        if (num1 + num2 === 100) {
          if (num1 > num2) {
            specs.strainType = `${num1}% Indica / ${num2}% Sativa`;
          } else if (num2 > num1) {
            specs.strainType = `${num2}% Sativa / ${num1}% Indica`;
          } else {
            specs.strainType = `50% Indica / 50% Sativa`;
          }
        } else {
          specs.strainType = rawIndicaSativa;
        }
      } else {
        specs.strainType = rawIndicaSativa;
      }
    }

    if (!specs.strainType) {
      const ratioMatch = cleanCombined.match(/\b(\d{1,2})\s*[\/:]\s*(\d{1,2})\b/);
      if (ratioMatch) {
        const num1 = parseInt(ratioMatch[1], 10);
        const num2 = parseInt(ratioMatch[2], 10);
        if (num1 + num2 === 100) {
          const bodyLower = cleanCombined.toLowerCase();
          if (bodyLower.includes('indica-leaning') || bodyLower.includes('indica-dominant') || bodyLower.includes('indica dominant') || bodyLower.includes('indica-forward')) {
            const indicaVal = Math.max(num1, num2);
            const sativaVal = Math.min(num1, num2);
            specs.strainType = `${indicaVal}% Indica / ${sativaVal}% Sativa`;
          } else if (bodyLower.includes('sativa-leaning') || bodyLower.includes('sativa-dominant') || bodyLower.includes('sativa dominant') || bodyLower.includes('sativa-forward')) {
            const sativaVal = Math.max(num1, num2);
            const indicaVal = Math.min(num1, num2);
            specs.strainType = `${sativaVal}% Sativa / ${indicaVal}% Indica`;
          } else {
            specs.strainType = `${num1}/${num2}`;
          }
        }
      }
    }

    if (!specs.strainType) {
      if (/indica[- ](?:leaning|dominant|forward|heavy|focused)/i.test(cleanCombined)) {
        specs.strainType = 'Indica-dominant';
      } else if (/sativa[- ](?:leaning|dominant|forward|heavy|focused)/i.test(cleanCombined)) {
        specs.strainType = 'Sativa-dominant';
      } else if (/balanced hybrid/i.test(cleanCombined) || /50\/50/i.test(cleanCombined)) {
        specs.strainType = 'Hybrid';
      } else if (/\bindica\b/i.test(cleanCombined) && !/\bsativa\b/i.test(cleanCombined)) {
        specs.strainType = 'Indica';
      } else if (/\bsativa\b/i.test(cleanCombined) && !/\bindica\b/i.test(cleanCombined)) {
        specs.strainType = 'Sativa';
      }
    }

    // 3. Extract Cycle / Flowering Time
    const cycleDomMatch = combinedText.match(/Cycle Time<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
    let rawCycleTime = cycleDomMatch ? cycleDomMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    if (rawCycleTime) {
      const daysM = rawCycleTime.match(/(\d+[-–\s]+to[\s–-]+\d+|\d+[-–]\d+)\s*days/i);
      specs.floweringTime = daysM ? daysM[1].replace(/\s+to\s+/i, '-').trim() + ' days' : rawCycleTime;
    }

    if (!specs.floweringTime) {
      const flowMatch = cleanCombined.match(/(\d+[-–]\d+\s*(?:days|weeks|tage|wochen))/i) ||
                        cleanCombined.match(/(?:cycle|harvest|flowering)\s*:?\s*(\d+[-–]\d+\s*(?:days|weeks)?)/i);
      if (flowMatch) {
        specs.floweringTime = flowMatch[1].trim();
      }
    }

    return specs;
  }

  async fetchMetafieldsFromHtml(url) {
    try {
      const res = await this.fetchWithRetry(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) return {};
      const html = await res.text();
      return this.parseShopifySpecs('', [], html);
    } catch (err) {
      return {};
    }
  }

  normalizeStrainName(title, breeder = 'Mephisto Genetics') {
    if (!title) return '';
    let name = title.trim();

    name = name.replace(/\s*-\s*Mephisto\s*Genetics\s*$/i, '');
    name = name.replace(/^Mephisto\s*Genetics\s*-\s*/i, '');
    name = name.replace(/\(\s*(?:AUTO|AUTOMATIC|REGULAR|REGULÄR|FEMINIZED)\s*\)/gi, '');
    name = name.replace(/\b(?:Feminized|Automatic|Regular)\s+Seeds\b/gi, '');

    return super.normalizeStrainName(name, breeder || 'Mephisto Genetics');
  }

  parseOffersFromHtml(html) {
    if (!html) return [];
    
    const productJsonMatch = html.match(/window\.Shopify\.Product\s*=\s*([\s\S]*?);/i) ||
                          html.match(/<script[^>]*id=["']ProductJson-[^"']*["'][^>]*>([\s\S]*?)<\/script>/i);

    if (productJsonMatch) {
      try {
        const data = JSON.parse(productJsonMatch[1]);
        if (data && Array.isArray(data.variants)) {
          return data.variants
            .map(v => {
              const seeds = this.parseSeedCount(v.title) || this.parseSeedCount(v.option1);
              if (!seeds) return null;
              const price = parseFloat(v.price) / (v.price > 1000 ? 100 : 1);
              if (isNaN(price) || price <= 0) return null;
              return {
                seeds,
                price,
                availability: v.available ? 'available' : 'out_of_stock',
                variantTitle: v.title
              };
            })
            .filter(Boolean);
        }
      } catch {}
    }

    const jsonLdRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = jsonLdRe.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        const offers = parsed.offers?.offers || parsed.offers || (parsed.hasVariant ? parsed.hasVariant.map(v => v.offers) : null);
        if (Array.isArray(offers) && offers.length > 0) {
          return offers
            .map(o => {
              const seeds = this.parseSeedCount(o.name || o.title || '');
              if (!seeds) return null;
              const price = parseFloat(o.price || o.priceSpecification?.price);
              if (isNaN(price) || price <= 0) return null;
              return {
                seeds,
                price,
                availability: o.availability?.includes('InStock') ? 'available' : 'out_of_stock'
              };
            })
            .filter(Boolean);
        }
      } catch {}
    }

    return [];
  }

  async scrape(scraperStatus, targetUrl) {
    this.log('info', `Starting ${this.shopName} scraper...`);
    scraperStatus.currentShop = this.shopName;
    
    const urlToFetch = targetUrl || `${this.baseUrl}/products.json`;
    let baseUrl = urlToFetch.replace(/\/products\.json$/, '').replace(/\/$/, '');
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
        res = await this.fetchWithRetry(url, {
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
        if (this.isNonStrain(p.title, p.body_html, p.tags)) {
          continue;
        }

        const breeder = 'Mephisto Genetics';
        const name = this.normalizeStrainName(p.title, breeder);
        const type = 'autoflower';
        let seedType = 'feminized';
        
        const tagsString = (p.tags || []).join(' ').toLowerCase();
        if (tagsString.includes('regular') || tagsString.includes('regulär')) {
          seedType = 'regular';
        }
        
        let specs = this.parseShopifySpecs(p.body_html, p.tags || []);
        const productUrl = `${baseUrl}/products/${p.handle}`;

        // Fetch HTML DOM for additional spec extraction if THC or Indica/Sativa or cycle time is missing
        if ((!specs.thc && !specs.cbd) || !specs.strainType || !specs.floweringTime) {
          try {
            const extraSpecs = await this.fetchMetafieldsFromHtml(productUrl);
            specs = {
              thc: specs.thc || extraSpecs.thc,
              cbd: specs.cbd || extraSpecs.cbd,
              strainType: specs.strainType || extraSpecs.strainType,
              floweringTime: specs.floweringTime || extraSpecs.floweringTime,
              genetics: specs.genetics || extraSpecs.genetics
            };
          } catch {}
        }
        
        // Find first valid seed variant for initial pricing/seeds info
        const validVariants = (p.variants || []).filter(v => {
          const s = this.parseSeedCount(v.title) || this.parseSeedCount(v.option1);
          const pr = parseFloat(v.price);
          return s && !isNaN(pr) && pr > 0;
        });

        if (validVariants.length === 0) {
          continue; // No valid seed variants for this product
        }

        const firstVariant = validVariants[0];
        const initialSeeds = this.parseSeedCount(firstVariant.title) || this.parseSeedCount(firstVariant.option1) || 1;
        const initialPrice = parseFloat(firstVariant.price) || 0;

        if (limit !== null && scrapedCount >= limit) {
          this.log('info', `Scraped limit of ${limit} strains for ${this.shopName}. Stopping scan.`);
          hasMore = false;
          break;
        }
        scrapedCount++;
        
        scraperStatus.currentProduct = p.title;

        let strainId;
        try {
          strainId = await this.upsertStrain({
            name,
            breeder,
            type,
            seedType,
            thc: specs.thc,
            cbd: specs.cbd,
            strainType: specs.strainType,
            floweringTime: specs.floweringTime,
            description: p.body_html || '',
            genetics: specs.genetics,
            url: productUrl,
            rawTitle: p.title,
            seeds: initialSeeds,
            price: initialPrice
          });
        } catch (dbErr) {
          this.log('error', `Database error for strain ${name}: ${dbErr.message}`);
          continue;
        }
        
        for (const v of validVariants) {
          const seeds = this.parseSeedCount(v.title) || this.parseSeedCount(v.option1);
          if (!seeds) continue;

          const price = parseFloat(v.price);
          let availability = 'available';
          if (v.available === false || String(v.available) === 'false' || v.available === 0) {
            availability = 'out_of_stock';
          } else if (v.inventory_quantity !== undefined && v.inventory_quantity <= 0) {
            availability = v.inventory_policy === 'continue' ? 'orderable' : 'out_of_stock';
          }
          
          if (!isNaN(price) && price > 0) {
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
}
