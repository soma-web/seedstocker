import { BaseScraper } from './BaseScraper.js';

const ALGOLIA_CONFIG = {
  appId: 'Q6BVPE7LU5',
  apiKey: '655ab8fc4d9bb483cb6b6694c73a159f',
  indexName: 'products_de',
  categoryFilter: 'all_product_categories:35',
  hitsPerPage: 100
};

export class ZamnesiaScraper extends BaseScraper {
  constructor(logMessage, scrapeMode = 'price') {
    super('Zamnesia', logMessage, scrapeMode);
  }

  normalizeStrainName(title, breeder) {
    if (!title) return '';
    let name = this.decodeHtmlEntities(title);
    name = super.normalizeStrainName(name, breeder || 'Zamnesia Seeds');
    if (name) {
      name = name
        .replace(/\s+(?:femini?[sz]ie?rt|feminized|regulär|regular)\s*$/i, '')
        .replace(/\s*\(\s*(?:femini?[sz]ie?rt|feminized|regulär|regular)\s*\)\s*$/i, '')
        .trim();
    }
    return name;
  }

  parseArgs(argsStr) {
    const args = [];
    let current = '';
    let inParens = 0;
    let inQuotes = false;
    let quoteChar = null;
    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];
      if (inQuotes) {
        if (char === quoteChar && argsStr[i-1] !== '\\') {
          inQuotes = false;
        }
        current += char;
      } else if (char === "'" || char === '"') {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (char === '(' || char === '[') {
        inParens++;
        current += char;
      } else if (char === ')' || char === ']') {
        inParens--;
        current += char;
      } else if (char === ',' && inParens === 0) {
        args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current) {
      args.push(current.trim());
    }
    return args;
  }

  decodeHtmlEntities(str) {
    if (!str) return '';
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&uuml;/g, 'ü')
      .replace(/&Uuml;/g, 'Ü')
      .replace(/&auml;/g, 'ä')
      .replace(/&Auml;/g, 'Ä')
      .replace(/&ouml;/g, 'ö')
      .replace(/&Ouml;/g, 'Ö')
      .replace(/&szlig;/g, 'ß')
      .replace(/&beta;/g, 'β')
      .replace(/&sup2;/g, '²')
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
  }

  parseFeaturesTable(html) {
    const features = {};
    if (!html) return features;

    const trMatches = [...html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/gi)];
    for (const trMatch of trMatches) {
      const trHtml = trMatch[0];
      const keyMatch = trHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/i) || trHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
      const valMatch = trHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);

      if (keyMatch) {
        const keyText = this.decodeHtmlEntities(keyMatch[1].replace(/<[^>]+>/g, '').trim()).toLowerCase();
        let valText = '';
        if (valMatch) {
          const valElem = trHtml.includes('<th') ? valMatch[0] : valMatch[1];
          if (valElem) {
            valText = this.decodeHtmlEntities(valElem.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
          }
        }

        if (keyText && valText) {
          features[keyText] = valText;
        }
      }
    }

    return features;
  }

  async algoliaQueriesRequest(paramsString) {
    const url = `https://${ALGOLIA_CONFIG.appId}-dsn.algolia.net/1/indexes/*/queries`;
    const body = {
      requests: [
        {
          indexName: ALGOLIA_CONFIG.indexName,
          params: paramsString,
        },
      ],
    };

    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-algolia-application-id': ALGOLIA_CONFIG.appId,
        'x-algolia-api-key': ALGOLIA_CONFIG.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Algolia request failed: HTTP ${res.status} ${text}`);
    }

    const json = await res.json();
    if (!json.results || !json.results[0]) {
      throw new Error('Unexpected Algolia response format.');
    }

    return json.results[0];
  }

  async fetchAllAlgoliaHits() {
    this.log('info', 'Fetching all seed products via Zamnesia Algolia API...');
    const params = new URLSearchParams();
    params.set('query', '');
    params.set('hitsPerPage', String(ALGOLIA_CONFIG.hitsPerPage));
    params.set('page', '0');
    params.set('filters', ALGOLIA_CONFIG.categoryFilter);

    const first = await this.algoliaQueriesRequest(params.toString());
    const allHits = [...(first.hits || [])];
    const nbPages = first.nbPages || 0;
    const nbHits = first.nbHits || allHits.length;

    this.log('info', `Algolia reported ${nbHits} products across ${nbPages} pages.`);

    for (let page = 1; page < nbPages; page++) {
      params.set('page', String(page));
      const result = await this.algoliaQueriesRequest(params.toString());
      if (Array.isArray(result.hits)) {
        allHits.push(...result.hits);
      }
      if (page % 5 === 0 || page === nbPages - 1) {
        this.log('info', `Fetched Algolia page ${page + 1}/${nbPages} (${allHits.length} hits)`);
      }
    }

    return allHits;
  }

  parseHitData(hit, html = null) {
    const rawTitle = (hit.name || '').trim();
    if (!rawTitle) return null;

    const features = html ? this.parseFeaturesTable(html) : {};

    let rawBreeder = features['marke'] || (hit.brand ? String(hit.brand).trim() : null);
    if (!rawBreeder || rawBreeder.toLowerCase() === 'zamnesia') {
      const titleParenMatch = rawTitle.match(/\(([^)]+)\)/);
      if (titleParenMatch && titleParenMatch[1]) {
        rawBreeder = titleParenMatch[1].trim();
      }
    }
    if (!rawBreeder) {
      rawBreeder = 'Zamnesia Seeds';
    }

    const breeder = this.normalizeBreeder(rawBreeder);
    const name = this.normalizeStrainName(rawTitle, breeder);

    let url = hit.product_url || hit.link || '';
    if (url.startsWith('https://www.zamnesia.com/')) {
      url = url.replace('https://www.zamnesia.com/', 'https://www.zamnesia.de/');
    }

    const description = (hit.description || hit.description_short || '').trim();
    
    let type = null;
    if (features['blütentyp']) {
      const bt = features['blütentyp'].toLowerCase();
      if (bt.includes('triploid')) type = 'triploid';
      else if (bt.includes('auto')) type = 'autoflower';
      else if (bt.includes('fast')) type = 'fast_flowering';
      else if (bt.includes('photoperiodisch') || bt.includes('photo')) type = 'photoperiodic';
    }
    if (!type) {
      type = this.determineStrainType(rawTitle, description);
    }

    let seedType = 'feminized';
    if (features['gattung']) {
      if (features['gattung'].toLowerCase().includes('regulär') || features['gattung'].toLowerCase().includes('regular')) {
        seedType = 'regular';
      }
    } else {
      const lowerTitle = rawTitle.toLowerCase();
      const lowerDesc = description.toLowerCase();
      if (lowerTitle.includes('regulär') || lowerTitle.includes('regular') || lowerDesc.includes('reguläre')) {
        seedType = 'regular';
      }
    }

    // strainType (Indica / Sativa ratio or dominance e.g. '80% Indica / 20% Sativa' -> 'indica-dominant')
    const rawGenetik = features['genetik'] || features['strain type'] || null;
    let strainType = rawGenetik ? this.normalizeStrainType(rawGenetik) : null;
    if (!strainType && description) {
      strainType = this.normalizeStrainType(description);
    }

    // genetics (Parent lineage e.g. 'Apple Fritter x Jet Fuel Gelato')
    let genetics = features['eltern'] || features['genetics'] || null;
    if (!genetics) {
      const genMatch = description.match(/(?:Ergebnis der Kombination von|Kreuzung aus|combines)\s+([^.]+?)(?:\.|$)/i);
      if (genMatch) {
        genetics = genMatch[1].trim();
      }
    }

    let thc = features['thc'] ? this.cleanThc(features['thc']) : null;
    if (!thc) {
      const thcMatch = description.match(/\b(\d+(?:\.\d+)?\s*%)\s*THC\b/i) ||
                       description.match(/\bTHC\s*:\s*(\d+(?:\.\d+)?\s*%)/i) ||
                       rawTitle.match(/\b(\d+%)\s*THC\b/i);
      thc = thcMatch ? this.cleanThc(thcMatch[1]) : null;
    }

    let cbd = features['cbd'] ? this.cleanCbd(features['cbd']) : null;
    if (!cbd) {
      const cbdMatch = description.match(/\b(\d+(?:\.\d+)?\s*%)\s*CBD\b/i) ||
                       description.match(/\bCBD\s*:\s*(\d+(?:\.\d+)?\s*%)/i);
      cbd = cbdMatch ? this.cleanCbd(cbdMatch[1]) : null;
    }

    let floweringTime = (features['blütezeit'] || features['flowering time']) ? this.cleanFloweringTime(features['blütezeit'] || features['flowering time']) : null;
    if (!floweringTime) {
      const floweringMatch = description.match(/(?:Blütezeit|Flowering Time)\s*:\s*([^.\n]+)/i) ||
                             description.match(/(\d+(?:\s*-\s*\d+)?\s*(?:Wochen|weeks))/i);
      floweringTime = floweringMatch ? this.cleanFloweringTime(floweringMatch[1]) : null;
    }

    const price = typeof hit.price === 'number' ? hit.price : (parseFloat(hit.price) || 0);

    let availability = 'available';
    if (hit.available_for_order === 0 || String(hit.out_of_stock) === '1') {
      availability = 'out_of_stock';
    }

    return {
      rawTitle,
      rawBreeder,
      breeder,
      name,
      url,
      description,
      type,
      seedType,
      strainType,
      genetics,
      thc,
      cbd,
      floweringTime,
      price,
      availability
    };
  }

  async scrape(scraperStatus, targetUrl) {
    this.log('info', 'Starting Zamnesia scraper...');
    scraperStatus.currentShop = this.shopName;

    if (targetUrl) {
      const urls = targetUrl.split(',').map(u => u.trim()).filter(Boolean);
      for (const url of urls) {
        try {
          await this.scrapeSingle(url);
          scraperStatus.productsScraped++;
        } catch (err) {
          this.log('error', `Error scraping target URL ${url}: ${err.message}`);
        }
      }
      return;
    }

    let hits;
    try {
      hits = await this.fetchAllAlgoliaHits();
    } catch (err) {
      this.log('error', `Failed to fetch products from Algolia API: ${err.message}`);
      return;
    }

    const limit = this.getLimit();
    if (limit !== null) {
      hits = hits.slice(0, limit);
      this.log('info', `Applying limit: processing first ${hits.length} items.`);
    }

    this.log('info', `Processing ${hits.length} products from Zamnesia...`);

    for (const hit of hits) {
      const parsed = this.parseHitData(hit);
      if (!parsed) continue;

      if (this.isInvalidStrainName(parsed.rawTitle, parsed.description, parsed.breeder)) {
        this.log('info', `Skipping invalid/collection strain: ${parsed.rawTitle}`);
        continue;
      }

      scraperStatus.currentProduct = parsed.rawTitle;

      if (this.scrapeMode === 'discovery') {
        const strainId = await this.upsertStrain({
          name: parsed.name,
          breeder: parsed.breeder,
          type: parsed.type,
          seedType: parsed.seedType,
          thc: parsed.thc,
          cbd: parsed.cbd,
          strainType: parsed.strainType,
          genetics: parsed.genetics,
          floweringTime: parsed.floweringTime,
          description: parsed.description,
          url: parsed.url,
          rawTitle: parsed.rawTitle,
          seeds: 1,
          price: parsed.price
        });
        if (strainId || this._currentDiscoveryStagedId) {
          scraperStatus.productsScraped++;
        }
      } else {
        // Price mode
        const strainId = await this.upsertStrain({
          name: parsed.name,
          breeder: parsed.breeder,
          type: parsed.type,
          seedType: parsed.seedType,
          thc: parsed.thc,
          cbd: parsed.cbd,
          strainType: parsed.strainType,
          genetics: parsed.genetics,
          floweringTime: parsed.floweringTime,
          description: parsed.description,
          url: parsed.url,
          rawTitle: parsed.rawTitle
        });

        if (!strainId) {
          // Unknown strain skipped in price mode
          continue;
        }

        // Try fetching page HTML for exact pack size combinations + features table
        let combinationsCreated = 0;
        if (parsed.url) {
          try {
            const pageRes = await this.fetchWithRetry(parsed.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
              }
            });
            if (pageRes.ok) {
              const html = await pageRes.text();
              
              // Enrich strain metadata with specs from features table if present
              const enriched = this.parseHitData(hit, html);
              if (enriched) {
                await this.upsertStrain({
                  name: enriched.name,
                  breeder: enriched.breeder,
                  type: enriched.type,
                  seedType: enriched.seedType,
                  thc: enriched.thc,
                  cbd: enriched.cbd,
                  strainType: enriched.strainType,
                  genetics: enriched.genetics,
                  floweringTime: enriched.floweringTime,
                  description: enriched.description,
                  url: enriched.url,
                  rawTitle: enriched.rawTitle
                });
              }

              const offers = this.parseOffersFromHtml(html);
              for (const offer of offers) {
                await this.insertOffer({
                  strainId,
                  url: parsed.url,
                  seeds: offer.seeds,
                  price: offer.price,
                  availability: offer.availability
                });
                combinationsCreated++;
                scraperStatus.productsScraped++;
              }
            }
          } catch (pageErr) {
            // HTML fetch failed, fallback to base offer
          }
        }

        if (combinationsCreated === 0 && parsed.price > 0) {
          await this.insertOffer({
            strainId,
            url: parsed.url,
            seeds: 1,
            price: parsed.price,
            availability: parsed.availability
          });
          scraperStatus.productsScraped++;
        }
      }
    }
    this.log('info', `Completed processing ${hits.length} Zamnesia products.`);
  }

  async scrapeSingle(url) {
    const res = await this.fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Zamnesia page (status ${res.status})`);
    }

    const html = await res.text();

    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (!h1Match) {
      throw new Error('Could not parse strain title from Zamnesia page.');
    }
    const rawTitle = h1Match[1].trim();

    const features = this.parseFeaturesTable(html);

    let rawBreeder = features['marke'] || null;
    if (!rawBreeder) {
      try {
        const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
        let jsonLdMatch;
        while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
          try {
            const data = JSON.parse(jsonLdMatch[1]);
            if (data && data['@type'] === 'Product' && data.brand) {
              rawBreeder = typeof data.brand === 'string' ? data.brand : data.brand.name;
            }
          } catch {}
        }
      } catch {}
    }

    if (!rawBreeder) {
      const titleParenMatch = rawTitle.match(/\(([^)]+)\)/);
      if (titleParenMatch && titleParenMatch[1]) {
        rawBreeder = titleParenMatch[1].trim();
      }
    }

    if (!rawBreeder) {
      rawBreeder = 'Zamnesia Seeds';
    }

    const breeder = this.normalizeBreeder(rawBreeder);
    const description = this.extractDescription(html);

    if (this.isInvalidStrainName(rawTitle, description, breeder)) {
      throw new Error(`Skipping invalid/collection strain: ${rawTitle}`);
    }

    const name = this.normalizeStrainName(rawTitle, breeder);

    let type = null;
    if (features['blütentyp']) {
      const bt = features['blütentyp'].toLowerCase();
      if (bt.includes('triploid')) type = 'triploid';
      else if (bt.includes('auto')) type = 'autoflower';
      else if (bt.includes('fast')) type = 'fast_flowering';
      else if (bt.includes('photoperiodisch') || bt.includes('photo')) type = 'photoperiodic';
    }
    if (!type) {
      type = this.determineStrainType(rawTitle, description);
    }

    let seedType = 'feminized';
    if (features['gattung']) {
      if (features['gattung'].toLowerCase().includes('regulär') || features['gattung'].toLowerCase().includes('regular')) {
        seedType = 'regular';
      }
    } else if (rawTitle.toLowerCase().includes('regulär') || rawTitle.toLowerCase().includes('regular') || html.toLowerCase().includes('reguläre')) {
      seedType = 'regular';
    }

    const offers = this.parseOffersFromHtml(html);
    if (offers.length === 0) {
      throw new Error(`No combinations/pricing offers found on page.`);
    }

    const thcRaw = features['thc'] || this.extractSpec(html, 'THC');
    const cbdRaw = features['cbd'] || this.extractSpec(html, 'CBD');
    const geneticsRaw = features['eltern'] || features['genetics'] || this.extractSpec(html, '(?:Genetik|Genetics)');
    const floweringRaw = features['blütezeit'] || this.extractSpec(html, '(?:Bl&uuml;tezeit|Blutezeit|Flowering\\s+Time)\\s*');
    const rawGenetik = features['genetik'] || features['strain type'] || null;

    const thc = this.cleanThc(thcRaw);
    const cbd = this.cleanCbd(cbdRaw);
    const floweringTime = this.cleanFloweringTime(floweringRaw);
    const genetics = this.cleanFilledValue(geneticsRaw);
    const strainType = rawGenetik ? this.normalizeStrainType(rawGenetik) : this.normalizeStrainType(description);

    const strainId = await this.upsertStrain({ name, breeder, type, seedType, thc, cbd, strainType, genetics, floweringTime, description, url, rawTitle: rawTitle || name });

    let offersCreated = 0;
    for (const offer of offers) {
      await this.insertOffer({ strainId, url, seeds: offer.seeds, price: offer.price, availability: offer.availability });
      offersCreated++;
    }

    return { name, breeder, type, seedType, strainType, genetics, thc, cbd, floweringTime, offersCreated, shop: this.shopName };
  }

  extractDescription(html) {
    let description = null;
    try {
      const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let jsonLdMatch;
      while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
        try {
          const data = JSON.parse(jsonLdMatch[1]);
          if (data && data['@type'] === 'Product' && data.description) {
            description = data.description;
            break;
          }
        } catch {}
      }
    } catch {}

    if (!description) {
      const descMetaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i) ||
                           html.match(/<meta\s+property=["']og:description["']\s+content=["']([\s\S]*?)["']/i);
      if (descMetaMatch) {
        description = descMetaMatch[1];
      }
    }
    return description || '';
  }

  parseOffersFromHtml(html) {
    const offers = [];
    const addCombinationRegex = /addCombination\s*\(\s*(.*?)\s*\)\s*;/g;
    let match;
    const psCombinations = [];
    while ((match = addCombinationRegex.exec(html)) !== null) {
      const argsStr = match[1];
      const args = this.parseArgs(argsStr);
      if (args.length >= 11) {
        const comboId = args[0];
        const attrIdsMatch = args[1].match(/new Array\((.*?)\)/i) || args[1].match(/\[(.*?)\]/);
        const attrIds = attrIdsMatch 
          ? attrIdsMatch[1].replace(/'/g, '').replace(/"/g, '').split(',').map(s => s.trim()).filter(Boolean)
          : [];
        const price = parseFloat(args[10]);
        const qty = parseInt(args[2], 10);
        const availability = qty > 0 ? 'available' : 'out_of_stock';
        psCombinations.push({ comboId, attrIds, price, availability });
      }
    }

    const attrLabelMap = {};
    const optRe = /<option\b[^>]*value="(\d+)"[^>]*(?:title="([^"]*)")?[^>]*>([^<]*)<\/option>/gi;
    let optM;
    while ((optM = optRe.exec(html)) !== null) {
      const attrId = optM[1];
      const titleLabel = (optM[2] || '').trim();
      const innerLabel = (optM[3] || '').trim();
      const label = titleLabel || innerLabel;
      if (label) attrLabelMap[attrId] = label;
    }

    if (psCombinations.length === 0) {
      const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let jsonLdMatch;
      let singlePrice = null;
      let singleAvailability = 'available';
      while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
        try {
          const data = JSON.parse(jsonLdMatch[1]);
          if (data['@type'] === 'Product' && data.offers && data.offers.price) {
            singlePrice = parseFloat(data.offers.price);
            if (data.offers.availability) {
              const av = String(data.offers.availability).toLowerCase();
              if (av.includes('outofstock')) {
                singleAvailability = 'out_of_stock';
              } else if (av.includes('preorder') || av.includes('backorder')) {
                singleAvailability = 'orderable';
              }
            }
          }
        } catch {}
      }
      if (singlePrice && !isNaN(singlePrice)) {
        psCombinations.push({ comboId: 'single', attrIds: [], price: singlePrice, availability: singleAvailability });
      }
    }

    for (const combo of psCombinations) {
      const labels = combo.attrIds.map(id => attrLabelMap[id] || '').join(' ');
      const seeds = this.parseSeedCount(labels) || this.parseSeedCount(combo.attrIds.map(id => attrLabelMap[id] || id).join(' ')) || 1;
      const price = combo.price;
      const availability = combo.availability || 'available';

      if (seeds > 0 && price > 0) {
        offers.push({ seeds, price, availability });
      }
    }

    return offers;
  }
}
