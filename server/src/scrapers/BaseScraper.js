import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { strains, scrapedOffers, priceHistory, strainShopDescriptions, rewrittenDescriptions, newScrapedEntries } from '../schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import crypto from 'node:crypto';
import { normalizeBreederName, CANONICAL_TO_ALIASES, KNOWN_BREEDERS } from './breeder-normalize.js';
import { getMaxItemsLimit, getBlockedWords } from '../config.js';
import { proxyManager } from './ProxyManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BaseScraper {
  constructor(shopName, logMessage, scrapeMode = 'price') {
    this.shopName = shopName;
    this.logMessage = logMessage;
    this.scrapeMode = scrapeMode;
    // Flips to true once this scraper instance hits a 429 and activates proxy
    this._proxyActive = false;
  }

  log(type, message) {
    if (this.logMessage) {
      this.logMessage(type, message);
    } else {
      console.log(`[${type.toUpperCase()}][${this.shopName}] ${message}`);
    }
  }

  getLimit() {
    return getMaxItemsLimit();
  }

  async clearOffers() {
    // NOTE: Only clears scraped_offers for this shop. Strain records are NEVER deleted here.
    await db.delete(scrapedOffers).where(eq(scrapedOffers.shop, this.shopName));
  }

  normalizeBreeder(breeder) {
    if (!breeder) return 'Unknown Breeder';
    const cleaned = breeder.replace(/[’‘\`′]/g, "'");
    const normalized = normalizeBreederName(cleaned);
    return normalized || 'Unknown Breeder';
  }

  normalizeStrainName(title, breeder) {
    let name = title.trim();

    // Normalize smart/curly apostrophes and quotes to standard ASCII single quote
    name = name.replace(/[’‘\`′]/g, "'");

    // Strip registered trademark (®) and trademark (™) symbols
    name = name.replace(/[®™]/g, '');

    // Strip leading "BF " or "TB " prefixes (shop/breeder abbreviations)
    name = name.replace(/^(BF|TB)[\s\-]+/i, '');

    // Strip trailing "by <Breeder>" or "von <Breeder>" from titles if matching a breeder
    const byMatch = name.match(/\s+(by|von)\s+(.+)$/i);
    if (byMatch) {
      const candidateBreeder = byMatch[2].trim().toLowerCase();
      if (KNOWN_BREEDERS.has(candidateBreeder) || (breeder && candidateBreeder === breeder.toLowerCase())) {
        name = name.substring(0, byMatch.index).trim();
      }
    }

    // Strip parenthesized breeder text from titles
    name = name.replace(/\(.*?\)/g, '');

    const stripKeywords = [
      'feminisiert', 'feminisierte', 'feminised', 'feminized', 'feminize', 'fem',
      'autoflowering', 'autoflower', 'automatic', 'auto',
      'reguläre', 'regulär', 'regular', 'reg',
      'fast flowering', 'fast version', 'fast',
      'triploid', 'triploide',
      'blitzversand', 'premium us', 'premium',
      'hanfsamen', 'cannabis', 'cannabis seeds', 'cannabissamen', 'seeds', 'samen',
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

      const aliases = CANONICAL_TO_ALIASES[breeder] || [];
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

  determineStrainType(title, text = '') {
    const titleLower = (title || '').toLowerCase();
    const textLower = (text || '').toLowerCase();

    // 1. Autoflower
    if (
      titleLower.includes('auto') ||
      /\bauto\b/i.test(titleLower) ||
      textLower.includes('autoflowering') ||
      textLower.includes('automatisch')
    ) {
      return 'autoflower';
    }

    // 2. Fast Flowering
    if (
      titleLower.includes('fast flowering') ||
      titleLower.includes('fast version') ||
      /\bfast\b/i.test(titleLower) ||
      textLower.includes('fast flowering') ||
      textLower.includes('fast version') ||
      textLower.includes('schnellblühend')
    ) {
      return 'fast_flowering';
    }

    // 3. Triploid
    if (
      titleLower.includes('triploid') ||
      textLower.includes('triploid') ||
      textLower.includes('triploide')
    ) {
      return 'triploid';
    }

    // 4. Default
    return 'photoperiodic';
  }

  isInvalidStrainName(title, description = '', breeder = '') {
    if (!title) return true;
    const lower = title.trim().toLowerCase();
    const descLower = (description || '').trim().toLowerCase();
    const breederLower = (breeder || '').trim().toLowerCase();

    // Ignore non-seed merchandise (Headshop, AC Infinity, Calmag, Grinder, Zusatzzahlung, pH Down, RAW brand, Puffco, Greenception, Herbgarden, Netztopf)
    if (
      breederLower === 'headshop' || 
      breederLower === 'head shop' || 
      breederLower.includes('ac infinity') || 
      lower.includes('ac infinity') ||
      breederLower.includes('calmag') ||
      lower.includes('calmag') ||
      lower.includes('grinder') ||
      lower.includes('zusatzzahlung') ||
      breederLower.includes('zusatzzahlung') ||
      lower.includes('ph down') ||
      lower.includes('ph-down') ||
      breederLower.includes('ph down') ||
      /\braw\b/i.test(lower) ||
      /\braw\b/i.test(breederLower) ||
      lower.includes('puffco') ||
      breederLower.includes('puffco') ||
      lower.includes('greenception') ||
      lower.includes('herbgarden') ||
      lower.includes('netztopf')
    ) {
      return true;
    }

    // Ignore any strains containing "pack"/"packs" or "mystery" (mix packs / bundles)
    if (/\bpacks?\b/i.test(lower) || lower.includes('mystery')) {
      return true;
    }

    // Ignore any strains containing "mix" (mix packs / bundles / assortments)
    if (lower.includes('mix')) {
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
      'bodendisplay',
      'vorratspackung',
      'ungeschält',
      'geschält',
      'adventskalender',
      'mix',
      'dose',
      'barney\'s farm dose',
      'barneys farm dose',
      'barney farm dose',
      'metalldose',
      'stashdose'
    ];
    if (invalidKeywords.some(kw => lower.includes(kw))) {
      return true;
    }

    // Check custom blocked words from scraper.json with word boundary regex
    const blocked = getBlockedWords();
    if (blocked.length > 0) {
      const matchBlocked = blocked.some(word => {
        const w = word.trim().toLowerCase();
        if (!w) return false;
        const escaped = w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        return regex.test(lower) || regex.test(breederLower);
      });
      if (matchBlocked) {
        this.log('info', `Skipping product "${title}" because it matches custom blocked word list.`);
        return true;
      }
    }

    return false;
  }

  cleanFilledValue(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') {
      return isNaN(val) ? null : val;
    }
    const str = String(val).trim();
    const lower = str.toLowerCase();
    if (lower.includes('extreme') || lower.includes('extrem')) {
      return '29%';
    }
    if (lower.includes('sehr viel')) {
      return '26%';
    }
    if (lower.includes('viel')) {
      return '20-24%';
    }
    if (lower.includes('normale menge') || lower.includes('normal')) {
      return '20%';
    }
    if (lower.includes('wenig')) {
      return '0-3%';
    }
    if (lower === '1%' || lower === '1 %' || lower === '0.1%' || lower === '<1%' || lower === '< 1%' || lower === 'gering') {
      return '0-1%';
    }
    if (
      lower === '' ||
      lower === 'not available' ||
      lower === 'n/a' ||
      lower === 'unknown' ||
      lower === 'keine angabe' ||
      lower === 'keine angaben' ||
      lower === 'k.a.' ||
      lower === 'unknown breeder' ||
      lower === 'unknown_breeder'
    ) {
      return null;
    }
    return str;
  }

  // Case-insensitive strain lookup (issue #9)
  async upsertStrain({ name, breeder, type, seedType, thc = null, cbd = null, strainType = null, floweringTime = null, floweringMin = null, floweringMax = null, description = null, genetics = null, url = null, rawTitle = null, seeds = 1, price = 0 }) {
    name = (name || '').replace(/[’‘\`′]/g, "'").trim();
    breeder = (breeder || '').replace(/[’‘\`′]/g, "'").trim();

    const bLower = breeder.toLowerCase();
    const nLower = name.toLowerCase();
    if (
      bLower === 'headshop' || 
      bLower === 'head shop' || 
      bLower.includes('ac infinity') || 
      nLower.includes('ac infinity') ||
      bLower.includes('calmag') ||
      nLower.includes('calmag') ||
      nLower.includes('grinder') ||
      nLower.includes('zusatzzahlung') ||
      bLower.includes('zusatzzahlung') ||
      nLower.includes('ph down') ||
      nLower.includes('ph-down') ||
      bLower.includes('ph down') ||
      /\braw\b/i.test(nLower) ||
      /\braw\b/i.test(bLower) ||
      nLower.includes('puffco') ||
      bLower.includes('puffco') ||
      nLower.includes('greenception') ||
      nLower.includes('herbgarden') ||
      nLower.includes('netztopf')
    ) {
      this.log('info', `Skipping strain "${name}" - Non-seed merchandise (Headshop/AC Infinity/Calmag/Grinder/Zusatzzahlung/pH Down/RAW/Puffco/Greenception/Herbgarden/Netztopf)`);
      return null;
    }

    let finalMin = floweringMin;
    let finalMax = floweringMax;
    if (floweringTime !== null && finalMin === null && finalMax === null) {
      const range = this.parseFloweringRange(floweringTime);
      finalMin = range.min;
      finalMax = range.max;
    }

    const cleanedType = this.cleanFilledValue(type);
    const cleanedSeedType = this.cleanFilledValue(seedType);
    const cleanedThc = this.cleanFilledValue(thc);
    const cleanedCbd = this.cleanFilledValue(cbd);
    const cleanedStrainType = this.cleanFilledValue(strainType);
    const cleanedFloweringTime = this.cleanFilledValue(floweringTime);
    const cleanedMin = this.cleanFilledValue(finalMin);
    const cleanedMax = this.cleanFilledValue(finalMax);
    const cleanedGenetics = this.cleanFilledValue(genetics);
    let strainId;

    const strainConditions = [
      sql`LOWER(TRIM(${strains.name})) = LOWER(TRIM(${name}))`,
      sql`LOWER(TRIM(${strains.breeder})) = LOWER(TRIM(${breeder}))`
    ];
    if (cleanedSeedType) {
      strainConditions.push(sql`LOWER(TRIM(${strains.seedType})) = LOWER(TRIM(${cleanedSeedType}))`);
    }

    // Use case-insensitive, whitespace-normalized matching to prevent duplicates
    const [existing] = await db.select()
      .from(strains)
      .where(and(...strainConditions))
      .limit(1);

    if (existing) {
      strainId = existing.id;

      // In price mode, skip all metadata updates — only prices are touched
      if (this.scrapeMode !== 'price') {
        const updateFields = {};
        // Only fill in fields that are currently null/empty — never overwrite existing data
        const checkAndUpdate = (field, newVal) => {
          const existingVal = existing[field];
          const isEmpty = existingVal === null || existingVal === undefined || existingVal === '';
          if (newVal !== null && isEmpty) {
            updateFields[field] = newVal;
          }
        };

        checkAndUpdate('type', cleanedType);
        checkAndUpdate('seedType', cleanedSeedType);
        checkAndUpdate('thc', cleanedThc);
        checkAndUpdate('cbd', cleanedCbd);
        checkAndUpdate('strainType', cleanedStrainType);
        checkAndUpdate('floweringTime', cleanedFloweringTime);
        checkAndUpdate('floweringMin', cleanedMin);
        checkAndUpdate('floweringMax', cleanedMax);
        checkAndUpdate('genetics', cleanedGenetics);

        if (Object.keys(updateFields).length > 0) {
          updateFields.updatedAt = new Date().toISOString();
          await db.update(strains)
            .set(updateFields)
            .where(eq(strains.id, strainId));
        }

        if (description !== null) {
          try {
            await this.upsertShopDescription(strainId, this.shopName, description);
          } catch (err) {
            this.log('error', `Failed to upsert description for ${name} at ${this.shopName}: ${err.message}`);
          }
        }
      }
    } else {
      // In price mode, don't create new strains — only update prices on known ones
      if (this.scrapeMode === 'price') {
        this.log('info', `[price mode] Skipping unknown strain "${name}" (${breeder}) — not in database.`);
        return null;
      }

      // Secondary duplicate guard: check if THIS shop already has an offer linked to a strain
      // with the same name (regardless of breeder). This catches cases where the breeder string
      // changed between scraper runs, which would bypass the primary name+breeder lookup above.
      const [shopMatch] = await db.select({ id: strains.id, breeder: strains.breeder })
        .from(strains)
        .innerJoin(scrapedOffers, eq(scrapedOffers.strainId, strains.id))
        .where(and(
          eq(scrapedOffers.shop, this.shopName),
          sql`LOWER(TRIM(${strains.name})) = LOWER(TRIM(${name}))`
        ))
        .limit(1);

      if (shopMatch) {
        this.log('info', `[dup-guard] Reusing existing strain "${name}" (found via shop offer — breeder was "${shopMatch.breeder}", incoming was "${breeder}").`);
        strainId = shopMatch.id;

        if (description !== null) {
          try {
            await this.upsertShopDescription(strainId, this.shopName, description);
          } catch (err) {
            this.log('error', `Failed to upsert description for ${name} at ${this.shopName}: ${err.message}`);
          }
        }

        return strainId;
      }

      // In discovery mode: Stage new strain candidate in new_scraped_entries table to protect main database
      if (this.scrapeMode === 'discovery') {
        const [suggestedMatch] = await db.select({ id: strains.id })
          .from(strains)
          .where(sql`LOWER(TRIM(${strains.name})) = LOWER(TRIM(${name}))`)
          .limit(1);

        const stagedConditions = [
          eq(newScrapedEntries.shop, this.shopName),
          sql`LOWER(TRIM(${newScrapedEntries.extractedName})) = LOWER(TRIM(${name}))`,
          sql`LOWER(TRIM(COALESCE(${newScrapedEntries.extractedBreeder}, ''))) = LOWER(TRIM(COALESCE(${breeder}, '')))`
        ];
        if (cleanedSeedType) {
          stagedConditions.push(sql`LOWER(TRIM(COALESCE(${newScrapedEntries.seedType}, ''))) = LOWER(TRIM(COALESCE(${cleanedSeedType}, '')))`);
        }

        const [alreadyStaged] = await db.select()
          .from(newScrapedEntries)
          .where(and(...stagedConditions))
          .limit(1);

        if (!alreadyStaged) {
          const stagedId = crypto.randomUUID();
          await db.insert(newScrapedEntries).values({
            id: stagedId,
            shop: this.shopName,
            shopProductUrl: url || '',
            rawTitle: rawTitle || name,
            extractedName: name,
            extractedBreeder: breeder,
            seeds: seeds || 1,
            price: price || 0,
            currency: 'EUR',
            type: cleanedType,
            seedType: cleanedSeedType,
            thc: cleanedThc,
            cbd: cleanedCbd,
            strainType: cleanedStrainType,
            floweringTime: cleanedFloweringTime,
            description: description ? this.stripHtml(description) : null,
            genetics: cleanedGenetics,
            suggestedStrainId: suggestedMatch ? suggestedMatch.id : null,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          this._currentDiscoveryStagedId = stagedId;
          this.log('info', `[discovery mode] Staged new entry: "${name}" (${breeder}) from ${this.shopName}`);
        } else {
          this._currentDiscoveryStagedId = alreadyStaged.id;
          const updateData = {};
          if (url && (!alreadyStaged.shopProductUrl || alreadyStaged.shopProductUrl === '')) {
            updateData.shopProductUrl = url;
          }
          if (rawTitle && (!alreadyStaged.rawTitle || alreadyStaged.rawTitle === '')) {
            updateData.rawTitle = rawTitle;
          }
          if (Object.keys(updateData).length > 0) {
            updateData.updatedAt = new Date().toISOString();
            await db.update(newScrapedEntries)
              .set(updateData)
              .where(eq(newScrapedEntries.id, alreadyStaged.id));
          }
          this.log('info', `[discovery mode] Candidate "${name}" already staged in review queue.`);
        }
        return null;
      }

      strainId = crypto.randomUUID();
      await db.insert(strains).values({
        id: strainId,
        name,
        breeder,
        type: cleanedType,
        seedType: cleanedSeedType,
        thc: cleanedThc,
        cbd: cleanedCbd,
        strainType: cleanedStrainType,
        floweringTime: cleanedFloweringTime,
        floweringMin: cleanedMin,
        floweringMax: cleanedMax,
        genetics: cleanedGenetics,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      if (description !== null) {
        try {
          await this.upsertShopDescription(strainId, this.shopName, description);
        } catch (err) {
          this.log('error', `Failed to upsert description for ${name} at ${this.shopName}: ${err.message}`);
        }
      }
    }

    return strainId;
  }


  stripHtml(html) {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async upsertShopDescription(strainId, shop, description) {
    if (!description) return;
    const cleanDesc = this.stripHtml(description);
    if (!cleanDesc) return;

    const [existing] = await db.select()
      .from(strainShopDescriptions)
      .where(and(
        eq(strainShopDescriptions.strainId, strainId),
        eq(strainShopDescriptions.shop, shop)
      ))
      .limit(1);

    const now = new Date().toISOString();
    if (!existing) {
      await db.insert(strainShopDescriptions)
        .values({
          strainId,
          shop,
          description: cleanDesc,
          createdAt: now,
          updatedAt: now
        });
    }
    // If a description already exists it is kept as-is (no overwrite)
  }

  extractSpec(html, headerPattern) {
    const regex = new RegExp(`<th>\\s*${headerPattern}\\s*</th>\\s*<td>\\s*([\\s\\S]*?)\\s*</td>`, 'i');
    const match = html.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * Unified cannabinoid value cleaner (issue #20)
   * Replaces the nearly-identical cleanThc() and cleanCbd() methods.
   * @param {string} val - Raw value string
   * @param {object} options
   * @param {'avg'|'max'} options.aggregation - How to combine multiple numbers
   * @param {object} options.defaults - Low/medium/high percentage defaults
   */
  cleanCannabinoidValue(val, { aggregation = 'avg', defaults = {} } = {}) {
    if (!val) return null;
    const str = val.trim().toLowerCase();

    const numbers = [];
    const numberRegex = /(\d+(?:\.\d+)?)/g;
    let match;
    while ((match = numberRegex.exec(str)) !== null) {
      numbers.push(parseFloat(match[1]));
    }
    if (numbers.length >= 2) {
      const result = aggregation === 'max'
        ? Math.max(...numbers)
        : Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length);
      return result + '%';
    }
    if (numbers.length === 1) {
      return numbers[0] + '%';
    }

    const low = defaults.low || '2%';
    const medium = defaults.medium || '10%';
    const high = defaults.high || '21%';

    if (str.includes('gering') || str.includes('low') || str.includes('mild')) {
      return low;
    }
    if (str.includes('mittel') || str.includes('medium') || str.includes('moderate')) {
      return medium;
    }
    if (str.includes('hoch') || str.includes('high') || str.includes('strong')) {
      return high;
    }

    const m = val.match(/(\d+(?:\.\d+)?\s*%\s*(?:-\s*\d+(?:\.\d+)?\s*%)?|\d+\s*-\s*\d+\s*%|\d+\s*%)/);
    if (m) return m[1].replace(/\s+/g, '').trim();
    return val.trim();
  }

  cleanThc(val) {
    return this.cleanCannabinoidValue(val, {
      aggregation: 'avg',
      defaults: { low: '2%', medium: '10%', high: '21%' }
    });
  }

  cleanCbd(val) {
    return this.cleanCannabinoidValue(val, {
      aggregation: 'max',
      defaults: { low: '1%', medium: '7%', high: '11%' }
    });
  }

  cleanFloweringTime(val) {
    if (!val) return null;
    const str = val.trim().toLowerCase();

    if (str.includes('tage') || str.includes('days')) {
      const numbers = [];
      const numberRegex = /(\d+)/g;
      let match;
      while ((match = numberRegex.exec(str)) !== null) {
        numbers.push(parseInt(match[1], 10));
      }
      if (numbers.length === 1) {
        return Math.round(numbers[0] / 7).toString();
      }
      if (numbers.length >= 2) {
        const minW = Math.round(Math.min(...numbers) / 7);
        const maxW = Math.round(Math.max(...numbers) / 7);
        return minW === maxW ? minW.toString() : `${minW}-${maxW}`;
      }
    }

    const m = val.match(/(\d+\s*-\s*\d+|\d+\s*–\s*\d+|\d+)/);
    if (m) {
      return m[1].replace(/\s+/g, '').trim();
    }
    return val.trim();
  }

  parseFloweringRange(val) {
    if (!val) return { min: null, max: null };
    const str = val.toString().trim();
    const isDays = /\b(tage|days?|d)\b/i.test(str);
    const numbers = [];
    const numberRegex = /(\d+)/g;
    let match;
    while ((match = numberRegex.exec(str)) !== null) {
      numbers.push(parseInt(match[1], 10));
    }
    if (numbers.length === 0) return { min: null, max: null };

    let min = numbers.length === 1 ? numbers[0] : Math.min(...numbers);
    let max = numbers.length === 1 ? numbers[0] : Math.max(...numbers);

    if (isDays && min > 20) {
      min = Math.round(min / 7);
      max = Math.round(max / 7);
    }

    // Unrealistic flowering times < 5 weeks are invalid
    if (min !== null && min < 5) min = null;
    if (max !== null && max < 5) max = null;

    return { min, max };
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
      // Support icons-row-item structure (used in House of Seeds and other themes)
      const iconsRowRe = /<h3[^>]*class=["']icons-row-item__title["'][^>]*>([\s\S]*?)<\/h3>[\s\S]*?<div[^>]*class=["']icons-row-item(?:__text)?["'][^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/gi;
      let match;
      let foundIconsRow = false;
      while ((match = iconsRowRe.exec(bodyHtml)) !== null) {
        foundIconsRow = true;
        const title = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        const valueText = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

        if (title.includes('blütezeit') || title.includes('blütendauer') || title.includes('flowering')) {
          flowering = valueText;
        } else if (title.includes('potenz') || title.includes('thc')) {
          thc = valueText;
        } else if (title.includes('sativa / indica') || title.includes('genetics') || title.includes('art') || title.includes('typ') || title.includes('abstammung')) {
          strainType = valueText;
        }
      }

      if (!foundIconsRow) {
        const liMatches = bodyHtml.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
        liMatches.forEach(li => {
          const liText = li.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (/THC-Gehalt/i.test(liText) || /THC:/i.test(liText)) {
            const match = liText.match(/(?:THC-Gehalt|THC):?\s*(?:ca\.)?s*([^.\n]+)/i);
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

  // Price validation added (issue #6)
  async insertOffer({ strainId, url, seeds, price, availability = 'available' }) {
    // In discovery mode: update the staged entry's URL, seeds and price if strainId is null
    if (this.scrapeMode === 'discovery' && (strainId === null || strainId === undefined) && this._currentDiscoveryStagedId) {
      const updateData = {};
      if (url) updateData.shopProductUrl = url;
      if (seeds && seeds > 0) updateData.seeds = seeds;
      if (price && price > 0) updateData.price = price;
      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = new Date().toISOString();
        await db.update(newScrapedEntries)
          .set(updateData)
          .where(eq(newScrapedEntries.id, this._currentDiscoveryStagedId));
      }
      return;
    }

    // In price mode, a null strainId means the strain wasn't found — skip silently
    if (strainId === null || strainId === undefined) return;

    // Reject offers with invalid prices
    if (price === null || price === undefined || isNaN(price) || price <= 0) {
      this.log('warning', `Skipping offer with invalid price: ${price} (seeds=${seeds}, url=${url})`);
      return;
    }

    const existingOffers = await db.select()
      .from(scrapedOffers)
      .where(
        and(
          eq(scrapedOffers.strainId, strainId),
          eq(scrapedOffers.shop, this.shopName),
          eq(scrapedOffers.seeds, seeds)
        )
      )
      .orderBy(desc(scrapedOffers.fetchedAt));

    const [existing, ...duplicateOffers] = existingOffers;

    if (existing) {
      // Update the current price on the offer
      await db.update(scrapedOffers)
        .set({
          url,
          price,
          availability,
          fetchedAt: new Date().toISOString()
        })
        .where(eq(scrapedOffers.id, existing.id));

      for (const duplicate of duplicateOffers) {
        await db.delete(scrapedOffers).where(eq(scrapedOffers.id, duplicate.id));
      }
    } else {
      // In price mode, don't create new offers — only refresh existing ones
      if (this.scrapeMode === 'price') {
        this.log('info', `[price mode] Skipping new offer for strain ${strainId}, seeds=${seeds} — not in database.`);
        return;
      }
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

    // Price history with 24h dedup (issue #7)
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

    let shouldInsertHistory = !latestHistory;
    if (latestHistory) {
      const priceChanged = latestHistory.price !== price;
      const lastTime = new Date(latestHistory.fetchedAt).getTime();
      const now = Date.now();
      const hoursSinceLast = (now - lastTime) / (1000 * 60 * 60);
      // Only record if price changed OR it's been more than 24h since last entry
      shouldInsertHistory = priceChanged || hoursSinceLast >= 24;
    }

    if (shouldInsertHistory) {
      const nowIso = new Date().toISOString();
      await db.insert(priceHistory).values({
        id: crypto.randomUUID(),
        strainId,
        shop: this.shopName,
        seeds,
        price,
        fetchedAt: nowIso
      });
      this.log('price', `[PRICE RECORDED] Shop: ${this.shopName} | StrainID: ${strainId} | Seeds: ${seeds} | Price: ${price} EUR | URL: ${url}`);
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

  /**
   * Fetch wrapper with automatic proxy fallback on 429.
   *
   * Flow:
   *   1. If proxy is already active for this session, go straight through proxy.
   *   2. Otherwise try direct fetch first.
   *   3. On 429: read Retry-After header, wait, then cycle to next proxy.
   *   4. If the proxy also returns 429, mark it failed and try the next one.
   *   5. If all proxies are exhausted, return the last response so the caller
   *      can decide what to do (existing callers already handle non-ok status).
   */
  async fetchWithRetry(url, options = {}) {
    // If proxy was already activated earlier in this session, use it immediately
    if (this._proxyActive) {
      return this._fetchViaProxy(url, options);
    }

    // --- Direct attempt ---
    let res;
    try {
      res = await fetch(url, options);
    } catch (err) {
      throw err; // network error — bubble up so caller can break/log as before
    }

    if (res.status !== 429) return res;

    // --- 429 hit: activate proxy fallback ---
    const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10);
    this.log('warning', `429 on ${url} — waiting ${retryAfter}s then retrying via proxy...`);
    await this.sleep(retryAfter * 1000);

    if (!proxyManager.enabled) {
      this.log('error', 'No proxy list configured — cannot recover from 429. Set proxy.list in scraper.json.');
      return res;
    }

    this._proxyActive = true;
    return this._fetchViaProxy(url, options);
  }

  /**
   * Internal: try each proxy in round-robin order until one succeeds or all fail.
   */
  async _fetchViaProxy(url, options = {}) {
    const maxAttempts = proxyManager.totalProxies || 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const next = proxyManager.nextAgent();
      if (!next) {
        this.log('error', `All ${maxAttempts} proxies exhausted for ${url}`);
        // Return a synthetic 429-like response so the caller breaks gracefully
        return new Response(null, { status: 429, statusText: 'All proxies exhausted' });
      }

      const { agent, index, hostPort } = next;
      this.log('info', `[proxy] Trying ${hostPort} for ${url}`);

      let res;
      try {
        res = await fetch(url, { ...options, dispatcher: agent });
      } catch (err) {
        this.log('warning', `[proxy] ${hostPort} connection error: ${err.message} — marking failed`);
        proxyManager.markFailed(index);
        continue;
      }

      if (res.status === 429) {
        this.log('warning', `[proxy] ${hostPort} also returned 429 — marking failed, trying next`);
        proxyManager.markFailed(index);
        await this.sleep(2000);
        continue;
      }

      this.log('info', `[proxy] ${hostPort} succeeded (${res.status}) for ${url}`);
      return res;
    }

    this.log('error', `All proxies failed for ${url}`);
    return new Response(null, { status: 429, statusText: 'All proxies failed' });
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
