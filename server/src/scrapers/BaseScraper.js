import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { strains, scrapedOffers } from '../schema.js';
import { eq, and } from 'drizzle-orm';
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
    
    return b;
  }

  normalizeStrainName(title, breeder) {
    let name = title.trim();
    
    // Strip parenthesized breeder text from titles
    name = name.replace(/\(.*?\)/g, '');
    
    if (breeder) {
      const breederEscaped = breeder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const breederRe = new RegExp(`^${breederEscaped}\\s*`, 'i');
      name = name.replace(breederRe, '');
    }
    
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
    
    return name.trim();
  }

  async upsertStrain({ name, breeder, type, seedType }) {
    let strainId;
    const [existing] = await db.select()
      .from(strains)
      .where(and(eq(strains.name, name), eq(strains.breeder, breeder)))
      .limit(1);
      
    if (existing) {
      strainId = existing.id;
      await db.update(strains)
        .set({
          type,
          seedType,
          updatedAt: new Date().toISOString()
        })
        .where(eq(strains.id, strainId));
    } else {
      strainId = crypto.randomUUID();
      await db.insert(strains).values({
        id: strainId,
        name,
        breeder,
        type,
        seedType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    return strainId;
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
