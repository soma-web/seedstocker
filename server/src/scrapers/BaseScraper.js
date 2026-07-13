import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { strains, scrapedOffers, priceHistory } from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BaseScraper {
  constructor(shopName, logMessage) {
    this.shopName = shopName;
    this.logMessage = logMessage;
    this.configPath = path.resolve(__dirname, '../../config/scraper.json');
  }

  log(type, message) {
    if (this.logMessage) {
      this.logMessage(type, message);
    } else {
      console.log(`[${type.toUpperCase()}][${this.shopName}] ${message}`);
    }
  }

  getLimit() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        if (typeof data.maxItemsPerShop === 'number') {
          return data.maxItemsPerShop;
        }
      }
    } catch (err) {
      this.log('error', `Failed reading config, defaulting to unlimited: ${err.message}`);
    }
    return null;
  }

  async clearOffers() {
    await db.delete(scrapedOffers).where(eq(scrapedOffers.shop, this.shopName));
  }

  normalizeBreeder(breeder) {
    if (!breeder) return 'Unknown Breeder';
    let b = breeder.trim();
    const lower = b.toLowerCase();
    
    if (lower.includes('barney') || lower.includes('barny')) return "Barney's Farm";
    if (lower.includes('royal queen') || lower.includes('rqs')) return 'Royal Queen Seeds';
    if (lower.includes('sensi seed')) return 'Sensi Seeds';
    if (lower.includes('dutch passion')) return 'Dutch Passion';
    if (lower.includes('green house') || lower.includes('greenhouse')) return 'Greenhouse Seeds';
    if (lower.includes('fastbuds') || lower.includes('fast buds') || lower.includes('2 fast 4 buds')) return 'FastBuds';
    if (lower.includes('sweet seed')) return 'Sweet Seeds';
    if (lower.includes('anesia')) return 'Anesia Seeds';
    if (lower.includes('zamnesia')) return 'Zamnesia Seeds';
    if (lower.includes('bud voyage') || lower.includes('budvoyage')) return 'Bud Voyage';
    
    return b;
  }

  normalizeStrainName(title, breeder) {
    let name = title.trim();
    
    // Strip parenthesized breeder text from titles
    name = name.replace(/\(.*?\)/g, '');
    
    const stripKeywords = [
      'feminisiert', 'feminised', 'feminized', 'feminize', 'fem',
      'autoflowering', 'autoflower', 'automatic', 'auto',
      'regulär', 'regular', 'reg',
      'hanfsamen', 'cannabis seeds', 'cannabissamen', 'seeds', 'samen',
      'f1 hybrid', 'f1'
    ];
    
    for (const kw of stripKeywords) {
      const kwRe = new RegExp(`\\b${kw}\\b`, 'gi');
      name = name.replace(kwRe, '');
      const kwDashRe = new RegExp(`\\s*-\\s*\\b${kw}\\b\\s*|\\s*\\b${kw}\\b\\s*-\\s*`, 'gi');
      name = name.replace(kwDashRe, '');
    }
    
    name = name.replace(/^[\s\-_,.]+/, '').replace(/[\s\-_,.()]+$/, '');
    name = name.replace(/\s+/g, ' ');
    
    if (breeder) {
      const breederEscaped = breeder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const spaceVariants = [breederEscaped];
      if (breeder.includes(' ')) {
        const noSpace = breeder.replace(/\s+/g, '');
        spaceVariants.push(noSpace.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
      }
      
      const breederAliases = {
        'Royal Queen Seeds': ['RQS'],
        'Dutch Passion': ['DP'],
        'Greenhouse Seeds': ['GHS'],
        'Sensi Seeds': ['Sensi'],
        'Sweet Seeds': ['Sweet'],
        'Anesia Seeds': ['Anesia'],
        'Zamnesia Seeds': ['Zamnesia'],
        'Bud Voyage': ['BudVoyage']
      };
      
      const aliases = breederAliases[breeder] || [];
      for (const alias of aliases) {
        spaceVariants.push(alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
      }
      
      for (const variant of spaceVariants) {
        // Strip at start of string
        const startRe = new RegExp(`^${variant}\\s*`, 'i');
        name = name.replace(startRe, '');
        
        // Strip with connecting prefixes like "von" or "by"
        const prefixRe = new RegExp(`\\b(von|by)\\s+${variant}\\b`, 'i');
        name = name.replace(prefixRe, '');
        
        // Strip at end of string
        const endRe = new RegExp(`\\s*${variant}\\b`, 'i');
        name = name.replace(endRe, '');
      }
    }
    
    name = name.replace(/^[\s\-_,.]+/, '').replace(/[\s\-_,.()]+$/, '');
    name = name.replace(/\s+/g, ' ');
    
    return name.trim();
  }

  isInvalidStrainName(title) {
    if (!title) return true;
    const lower = title.trim().toLowerCase();
    
    // Ignore any strains containing "pack"/"packs" or "mystery" (mix packs / bundles)
    if (/\bpacks?\b/i.test(lower) || lower.includes('mystery')) {
      return true;
    }

    const invalidKeywords = [
      'bestseller',
      'collection',
      'mix pack',
      'mix-pack',
      'mixpack',
      'gift card',
      'gutschein',
      'bundle',
      'wood display',
      'bodendisplay'
    ];
    return invalidKeywords.some(kw => lower.includes(kw));
  }

  async upsertStrain({ name, breeder, type, seedType, thc = null, cbd = null, strainType = null, floweringTime = null, floweringMin = null, floweringMax = null }) {
    let strainId;
    const [existing] = await db.select()
      .from(strains)
      .where(and(eq(strains.name, name), eq(strains.breeder, breeder)))
      .limit(1);
      
    let finalMin = floweringMin;
    let finalMax = floweringMax;
    if (floweringTime !== null && finalMin === null && finalMax === null) {
      const range = this.parseFloweringRange(floweringTime);
      finalMin = range.min;
      finalMax = range.max;
    }
      
    const setValues = {
      type,
      seedType,
      updatedAt: new Date().toISOString()
    };
    if (thc !== null) setValues.thc = thc;
    if (cbd !== null) setValues.cbd = cbd;
    if (strainType !== null) setValues.strainType = strainType;
    if (floweringTime !== null) setValues.floweringTime = floweringTime;
    if (finalMin !== null) setValues.floweringMin = finalMin;
    if (finalMax !== null) setValues.floweringMax = finalMax;

    if (existing) {
      strainId = existing.id;
      await db.update(strains)
        .set(setValues)
        .where(eq(strains.id, strainId));
    } else {
      strainId = crypto.randomUUID();
      await db.insert(strains).values({
        id: strainId,
        name,
        breeder,
        type,
        seedType,
        thc,
        cbd,
        strainType,
        floweringTime,
        floweringMin: finalMin,
        floweringMax: finalMax,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    return strainId;
  }

  extractSpec(html, headerPattern) {
    const regex = new RegExp(`<th>\\s*${headerPattern}\\s*</th>\\s*<td>\\s*([\\s\\S]*?)\\s*</td>`, 'i');
    const match = html.match(regex);
    return match ? match[1].trim() : null;
  }

  cleanThc(val) {
    if (!val) return null;
    const str = val.trim().toLowerCase();
    
    if (str.includes('gering') || str.includes('low') || str.includes('mild')) {
      return '2%';
    }
    if (str.includes('mittel') || str.includes('medium') || str.includes('moderate')) {
      return '10%';
    }
    if (str.includes('hoch') || str.includes('high') || str.includes('strong')) {
      return '21%';
    }

    const m = val.match(/(\d+(?:\.\d+)?\s*%\s*(?:-\s*\d+(?:\.\d+)?\s*%)?|\d+\s*-\s*\d+\s*%|\d+\s*%)/);
    if (m) return m[1].replace(/\s+/g, '').trim();
    const num = val.match(/(\d+(?:\.\d+)?)/);
    if (num) return num[1] + '%';
    return val.trim();
  }

  cleanCbd(val) {
    if (!val) return null;
    const str = val.trim().toLowerCase();
    
    if (str.includes('gering') || str.includes('low') || str.includes('mild')) {
      return '1%';
    }
    if (str.includes('mittel') || str.includes('medium') || str.includes('moderate')) {
      return '7%';
    }
    if (str.includes('hoch') || str.includes('high') || str.includes('strong')) {
      return '11%';
    }

    const numbers = [];
    const numberRegex = /(\d+(?:\.\d+)?)/g;
    let match;
    while ((match = numberRegex.exec(str)) !== null) {
      numbers.push(parseFloat(match[1]));
    }
    if (numbers.length >= 2) {
      const maxVal = Math.max(...numbers);
      return maxVal + '%';
    }

    const m = val.match(/(\d+(?:\.\d+)?\s*%\s*(?:-\s*\d+(?:\.\d+)?\s*%)?|\d+\s*-\s*\d+\s*%|\d+\s*%)/);
    if (m) return m[1].replace(/\s+/g, '').trim();
    const num = val.match(/(\d+(?:\.\d+)?)/);
    if (num) return num[1] + '%';
    return val.trim();
  }

  cleanFloweringTime(val) {
    if (!val) return null;
    const m = val.match(/(\d+\s*-\s*\d+|\d+\s*–\s*\d+|\d+)/);
    if (m) {
      return m[1].replace(/\s+/g, '').trim();
    }
    return val.trim();
  }

  parseFloweringRange(val) {
    if (!val) return { min: null, max: null };
    const str = val.toString().trim();
    const numbers = [];
    const numberRegex = /(\d+)/g;
    let match;
    while ((match = numberRegex.exec(str)) !== null) {
      numbers.push(parseInt(match[1], 10));
    }
    if (numbers.length === 1) {
      return { min: numbers[0], max: numbers[0] };
    }
    if (numbers.length >= 2) {
      return { min: Math.min(...numbers), max: Math.max(...numbers) };
    }
    return { min: null, max: null };
  }

  normalizeStrainType(val, tags = []) {
    const typeTags = ['indica', 'sativa', 'indica-dominant', 'sativa-dominant'];
    for (const tag of tags) {
      const tLower = tag.toLowerCase();
      if (typeTags.includes(tLower)) return tLower;
    }

    if (val) {
      const str = val.toLowerCase();
      const indicaMatch = str.match(/(\d+)\s*%\s*indica/i) || str.match(/indica\s*(\d+)\s*%/i);
      const sativaMatch = str.match(/(\d+)\s*%\s*sativa/i) || str.match(/sativa\s*(\d+)\s*%/i);
      
      if (indicaMatch && sativaMatch) {
        const ind = parseInt(indicaMatch[1], 10);
        const sat = parseInt(sativaMatch[1], 10);
        if (ind > sat + 10) return 'indica-dominant';
        if (sat > ind + 10) return 'sativa-dominant';
        return 'hybrid';
      }
      
      if (str.includes('indica-dominant') || str.includes('indica dominant') || str.includes('indica-lastig')) return 'indica-dominant';
      if (str.includes('sativa-dominant') || str.includes('sativa dominant') || str.includes('sativa-lastig')) return 'sativa-dominant';
      if (str.includes('indica')) return 'indica';
      if (str.includes('sativa')) return 'sativa';
      if (str.includes('hybrid') || str.includes('hybride')) return 'hybrid';
    }

    for (const tag of tags) {
      const tLower = tag.toLowerCase();
      if (tLower === 'hybrid' || tLower.includes('hybrid') || tLower.includes('hybride')) return 'hybrid';
    }

    return null;
  }

  parseShopifySpecs(bodyHtml, tags) {
    const plainText = bodyHtml ? bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    
    let thc = null;
    let cbd = null;
    let flowering = null;
    let strainType = null;

    if (bodyHtml) {
      const liMatches = bodyHtml.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      liMatches.forEach(li => {
        const liText = li.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (/THC-Gehalt/i.test(liText) || /THC:/i.test(liText)) {
          const match = liText.match(/(?:THC-Gehalt|THC):?\s*(?:ca\.)?\s*([^.\n]+)/i);
          if (match) thc = match[1].trim();
        }
        if (/CBD/i.test(liText)) {
          const match = liText.match(/(?:CBD-Gehalt|CBD):?\s*(?:ca\.)?\s*([^.\n]+)/i);
          if (match) cbd = match[1].trim();
        }
        if (/Blütephase|Blütezeit|Blütendauer|Flowering/i.test(liText)) {
          const match = liText.match(/(?:Blütephase|Blütezeit|Blütendauer|Flowering|Flowering\s+Time):?\s*([^.\n]+)/i);
          if (match) flowering = match[1].trim();
        }
        if (/Art:|Typ:|Type:/i.test(liText)) {
          const match = liText.match(/(?:Art|Typ|Type):?\s*([^.\n]+)/i);
          if (match) strainType = match[1].trim();
        }
      });
    }

    // Fallbacks using plain text regex if not found in list items
    if (!thc) {
      const match = plainText.match(/(?:THC-Gehalt|THC|Potenz):?\s*(?:ca\.)?\s*([0-9]+(?:\.[0-9]+)?\s*%\s*(?:-\s*[0-9]+(?:\.[0-9]+)?\s*%)?|[0-9]+\s*-\s*[0-9]+\s*%|[0-9]+\s*%)/i);
      if (match) thc = match[1].trim();
    }
    if (!cbd) {
      const match = plainText.match(/(?:CBD-Gehalt|CBD):?\s*(?:ca\.)?\s*([0-9]+(?:\.[0-9]+)?\s*%\s*(?:-\s*[0-9]+(?:\.[0-9]+)?\s*%)?|[0-9]+\s*-\s*[0-9]+\s*%|[0-9]+\s*%)/i);
      if (match) cbd = match[1].trim();
    }
    if (!flowering) {
      const match = plainText.match(/(?:Blütephase|Blütezeit|Blütendauer):?\s*([0-9]+(?:\s*-\s*[0-9]+)?\s*(?:Wochen|Weeks|Tage|Days)?)/i);
      if (match) flowering = match[1].trim();
    }

    return {
      thc: this.cleanThc(thc),
      cbd: this.cleanCbd(cbd),
      floweringTime: this.cleanFloweringTime(flowering),
      strainType: this.normalizeStrainType(strainType, tags)
    };
  }

  async insertOffer({ strainId, url, seeds, price, availability = 'available' }) {
    const [existing] = await db.select()
      .from(scrapedOffers)
      .where(
        and(
          eq(scrapedOffers.strainId, strainId),
          eq(scrapedOffers.shop, this.shopName),
          eq(scrapedOffers.seeds, seeds)
        )
      )
      .limit(1);

    if (existing) {
      await db.update(scrapedOffers)
        .set({
          url,
          price,
          availability,
          fetchedAt: new Date().toISOString()
        })
        .where(eq(scrapedOffers.id, existing.id));
    } else {
      await db.insert(scrapedOffers).values({
        id: crypto.randomUUID(),
        strainId,
        shop: this.shopName,
        url,
        seeds,
        price,
        availability,
        fetchedAt: new Date().toISOString()
      });
    }

    // Check if price has changed from the latest recorded history entry
    const [latestHistory] = await db.select()
      .from(priceHistory)
      .where(
        and(
          eq(priceHistory.strainId, strainId),
          eq(priceHistory.shop, this.shopName),
          eq(priceHistory.seeds, seeds)
        )
      )
      .orderBy(desc(priceHistory.fetchedAt))
      .limit(1);

    const shouldInsertHistory = !latestHistory || latestHistory.price !== price;

    if (shouldInsertHistory) {
      await db.insert(priceHistory).values({
        id: crypto.randomUUID(),
        strainId,
        shop: this.shopName,
        seeds,
        price,
        fetchedAt: new Date().toISOString()
      });
    }
  }

  parseSeedCount(text) {
    if (!text) return null;
    const str = text.trim();
    const patterns = [
      /(\d+)\s*(?:x\s*)?(?:seeds?|samen|stücke?|stk|pcs|feminized|auto)/i,
      /(\d+)\s*[xX]\s*(?:samen|seed|stk|pcs)/i,
      /(?:pack(?:age)?\s+of|x)\s*(\d+)/i,
      /(\d+)\s*-?\s*(?:er\s*)?pack/i,
      /[-–]\s*(\d+)\s*$/,
      /^(\d+)x?\s*$/,
    ];
    for (const p of patterns) {
      const m = str.match(p);
      if (m) return parseInt(m[1], 10);
    }
    return null;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
