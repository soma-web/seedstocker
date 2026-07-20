import { db, sqlite } from '../db.js';
import { strains } from '../schema.js';
import { eq, or, isNull, and, inArray } from 'drizzle-orm';
import { BaseScraper } from './BaseScraper.js';

export class SeedfinderScraper extends BaseScraper {
  constructor(logMessage) {
    super('Seedfinder.eu', logMessage);
    this.baseUrl = 'https://seedfinder.eu';
    this.rateLimitDelay = 1000; // 1 request per second
    
    // Breeder name mapping: our name -> seedfinder.eu slug
    this.breederMap = {
      'Royal Queen Seeds': 'royal-queen-seeds',
      'Zamnesia Seeds': 'zamnesia',
      'FastBuds': 'fast-buds-company',
      "Barney's Farm": 'barneys-farm',
      'Greenhouse Seeds': 'greenhouse-seeds',
      'Ripper Seeds': 'ripper-seeds',
      'Exotic Genetix': 'exotic-genetix',
      'Exotic Seed': 'exotic-seed',
      'Compound Genetics': 'compound-genetics',
      'Kannabia': 'kannabia',
      'Karma Genetics': 'karma-genetics',
      'Solfire Gardens': 'solfire-gardens',
      'The Bulldog Seeds': 'the-bulldog-seeds',
      'Doja': 'doja',
      'Archive Seeds': 'archive-seeds',
      'Tiki Madman': 'tiki-madman',
      'Wizard Trees': 'wizard-trees',
      'Neon Runtz': 'neon-runtz',
      'Holy Smoke Seeds': 'holy-smoke-seeds',
      'Seed Junky Genetics': 'seed-junky-genetics',
      'Relentless Genetics Seeds': 'relentless-genetics',
      'Cannarado': 'cannarado',
      'Bud Voyage': 'bud-voyage',
      'Bosten Roots': 'bosten-roots',
      'Grounded Genetics': 'grounded-genetics',
      'Gas Co. Genetics': 'gas-co-genetics',
      'Gas Station Co. Seeds': 'gas-station-co-seeds',
      'Holy Hemp': 'holy-hemp',
      'Nine Weeks Harvest': 'nine-weeks-harvest',
      'Elev8 Seeds Genetics': 'elev8-seeds-genetics',
      'Terphogz Genetics': 'terphogz-genetics',
    };
  }

  async scrape(scraperStatus, shop = null) {
    this.log('info', 'Starting Seedfinder.eu metadata enrichment scraper...');

    let missingStrains = [];

    if (shop) {
      this.log('info', `Filtering strains by shop: ${shop}`);
      // Find strains associated with the selected shop that are missing key metadata
      const shopStrains = sqlite.prepare(`
        SELECT DISTINCT strain_id FROM scraped_offers WHERE shop = ?
      `).all(shop);

      const strainIds = shopStrains.map(row => row.strain_id);

      if (strainIds.length === 0) {
        this.log('info', `No strains found for shop: ${shop}`);
        missingStrains = [];
      } else {
        missingStrains = await db.select()
          .from(strains)
          .where(
            and(
              inArray(strains.id, strainIds),
              or(
                isNull(strains.strainType),
                isNull(strains.floweringTime),
                isNull(strains.environment),
                isNull(strains.seedfinderUrl)
              )
            )
          );
      }
    } else {
      // Find any strains missing key metadata (original behavior)
      missingStrains = await db.select()
        .from(strains)
        .where(
          or(
            isNull(strains.strainType),
            isNull(strains.floweringTime),
            isNull(strains.environment),
            isNull(strains.seedfinderUrl)
          )
        );
    }

    this.log('info', `Found ${missingStrains.length} strains missing metadata`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (const strain of missingStrains) {
      if (scraperStatus && !scraperStatus.isScanning) {
        this.log('info', 'Scraper stopped by user');
        break;
      }

      processed++;
      scraperStatus.currentProduct = `${strain.name} (${strain.breeder})`;

      try {
        const result = await this.scrapeStrain(strain);
        if (result) {
          updated++;
          this.log('success', `Updated ${strain.name}: ${Object.keys(result).join(', ')}`);
        } else {
          this.log('info', `No data found for ${strain.name}`);
        }
      } catch (err) {
        errors++;
        this.log('error', `Failed to scrape ${strain.name}: ${err.message}`);
      }

      if (scraperStatus) {
        scraperStatus.productsScraped = processed;
      }

      // Rate limiting
      await this.sleep(this.rateLimitDelay);
    }

    this.log('info', `Scraping complete: ${processed} processed, ${updated} updated, ${errors} errors`);
    return { processed, updated, errors };
  }

  async scrapeStrain(strain) {
    // Get the seedfinder.eu breeder slug if we have a mapping
    const breederSlug = this.breederMap[strain.breeder];
    
    // Strategy 1: Search with just strain name (most reliable)
    this.log('info', `Searching for: ${strain.name}`);
    let searchResults = await this.searchStrains(strain.name);
    let match = null;

    if (searchResults && searchResults.length > 0) {
      // If we have a breeder mapping, filter by that breeder first
      if (breederSlug) {
        match = this.findBestMatch(strain, searchResults, breederSlug);
      } else {
        match = this.findBestMatch(strain, searchResults);
      }
    }

    // Strategy 2: Try shortened name if still no match (remove common suffixes)
    if (!match) {
      const shortenedName = strain.name
        .replace(/\s*(Fast Version|Auto|Automatic|Feminized|Regular|F1|Photoperiodic)\s*/gi, '')
        .trim();
      if (shortenedName !== strain.name && shortenedName.length > 2) {
        this.log('info', `Trying shortened name: ${shortenedName}`);
        searchResults = await this.searchStrains(shortenedName);
        if (searchResults && searchResults.length > 0) {
          if (breederSlug) {
            match = this.findBestMatch({ ...strain, name: shortenedName }, searchResults, breederSlug);
          } else {
            match = this.findBestMatch({ ...strain, name: shortenedName }, searchResults);
          }
        }
      }
    }

    if (!match) {
      this.log('info', `No matching strain found for ${strain.name}`);
      return null;
    }

    this.log('info', `Found match: ${match.name} (${match.breeder})`);

    // Fetch strain detail page
    const detailData = await this.fetchStrainDetail(match.url);
    if (!detailData) {
      return null;
    }

    // Update database
    const updates = {};
    
    if (detailData.strainType && !strain.strainType) {
      updates.strainType = detailData.strainType;
    }
    if (detailData.floweringTime && !strain.floweringTime) {
      updates.floweringTime = detailData.floweringTime;
      const range = this.parseFloweringRange(detailData.floweringTime);
      if (range.min) updates.floweringMin = range.min;
      if (range.max) updates.floweringMax = range.max;
    }
    if (detailData.seedType && !strain.seedType) {
      updates.seedType = detailData.seedType;
    }
    if (detailData.environment && !strain.environment) {
      updates.environment = detailData.environment;
    }
    if (detailData.thc && !strain.thc) {
      updates.thc = detailData.thc;
    }
    if (detailData.cbd && !strain.cbd) {
      updates.cbd = detailData.cbd;
    }
    if (detailData.plantHeight && !strain.plantHeight) {
      updates.plantHeight = detailData.plantHeight;
    }
    if (detailData.harvestMonth && !strain.harvestMonth) {
      updates.harvestMonth = detailData.harvestMonth;
    }
    if (detailData.genetics && !strain.genetics) {
      updates.genetics = detailData.genetics;
    }
    if (detailData.effects && !strain.effects) {
      updates.effects = detailData.effects;
    }
    if (detailData.rating !== undefined && !strain.rating) {
      updates.rating = detailData.rating;
    }
    if (detailData.yieldd && !strain.yieldd) {
      updates.yieldd = detailData.yieldd;
    }
    if (detailData.image && !strain.image) {
      updates.image = detailData.image;
    }

    if (Object.keys(updates).length === 0) {
      return null;
    }

    updates.seedfinderUrl = match.url;
    updates.updatedAt = new Date().toISOString();

    await db.update(strains)
      .set(updates)
      .where(eq(strains.id, strain.id));

    return updates;
  }

  async searchStrains(query) {
    const encodedQuery = encodeURIComponent(query);
    const url = `${this.baseUrl}/en/search/results?search=${encodedQuery}`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });

      if (!res.ok) {
        throw new Error(`Search returned status ${res.status}`);
      }

      const html = await res.text();
      return this.parseSearchResults(html);
    } catch (err) {
      this.log('error', `Search failed: ${err.message}`);
      return [];
    }
  }

  parseSearchResults(html) {
    const results = [];
    
    // Parse HTML table with search results
    const tableRowRegex = /<tr[^>]*>\s*<td[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
    
    let match;
    while ((match = tableRowRegex.exec(html)) !== null) {
      const url = match[1];
      const name = match[2].replace(/<[^>]+>/g, '').trim();
      const breeder = match[3].replace(/<[^>]+>/g, '').trim();
      const floweringDays = match[4].replace(/<[^>]+>/g, '').trim();

      if (name && breeder) {
        results.push({
          name,
          breeder,
          url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
          floweringDays: floweringDays !== '-' ? floweringDays : null
        });
      }
    }

    return results;
  }

  normalizeBreederName(name) {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/\s*seeds?\s*/g, '')
      .replace(/\s*bank\s*/g, '')
      .replace(/\s*company\s*/g, ' co')
      .replace(/\s*genetics?\s*/g, '')
      .replace(/[.\-]/g, '')
      .trim();
  }

  findBestMatch(targetStrain, results, breederSlug = null) {
    const targetName = targetStrain.name.toLowerCase();

    // Score each result
    let bestMatch = null;
    let bestScore = 0;

    for (const result of results) {
      let score = 0;
      const resultName = result.name.toLowerCase();
      const resultUrl = result.url.toLowerCase();

      // Exact name match
      if (resultName === targetName) {
        score += 100;
      } else if (resultName.includes(targetName) || targetName.includes(resultName)) {
        score += 50;
      }

      // Breeder match - if we have a slug, check if it's in the URL
      if (breederSlug) {
        if (resultUrl.includes(`/${breederSlug}`)) {
          score += 50;
        }
      } else {
        // Fallback to normalized breeder name matching
        const targetBreeder = this.normalizeBreederName(targetStrain.breeder);
        const resultBreeder = this.normalizeBreederName(result.breeder);

        if (targetBreeder && resultBreeder) {
          if (resultBreeder === targetBreeder) {
            score += 50;
          } else if (resultBreeder.includes(targetBreeder) || targetBreeder.includes(resultBreeder)) {
            score += 25;
          }
        }
      }

      if (score > bestScore && score >= 50) {
        bestScore = score;
        bestMatch = result;
      }
    }

    return bestMatch;
  }

  async fetchStrainDetail(url) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });

      if (!res.ok) {
        throw new Error(`Detail page returned status ${res.status}`);
      }

      const html = await res.text();
      return this.parseStrainDetail(html);
    } catch (err) {
      this.log('error', `Failed to fetch detail page: ${err.message}`);
      return null;
    }
  }

  parseStrainDetail(html) {
    const data = {};

    // Extract JSON-LD structured data
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        data.rating = jsonLd.aggregateRating?.ratingValue;
        data.image = jsonLd.image;
        
        // Extract additional properties from JSON-LD
        if (jsonLd.additionalProperty && Array.isArray(jsonLd.additionalProperty)) {
          for (const prop of jsonLd.additionalProperty) {
            if (prop.name === 'Flowering time (days)' && prop.value) {
              data.floweringTime = String(prop.value);
            }
            if (prop.name === 'Feminized' && prop.value) {
              const val = String(prop.value).toLowerCase();
              if (val.includes('only') || val.includes('feminized')) {
                data.seedType = 'feminized';
              } else if (val.includes('regular')) {
                data.seedType = 'regular';
              }
            }
          }
        }
      } catch {}
    }

    // Extract from HTML content - look for structured data in description
    const descriptionMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    if (descriptionMatch) {
      const fullText = descriptionMatch.join(' ');
      
      // Strain type - look for "is an indica" or "is a sativa" or "is a hybrid"
      const strainTypeMatch = fullText.match(/is\s+(?:an?\s+)?(indica|sativa|hybrid)/i);
      if (strainTypeMatch) {
        data.strainType = strainTypeMatch[1].toLowerCase();
      }
      
      // Environment - look for "can be cultivated indoors and outdoors" or similar
      const envMatch = fullText.match(/can be cultivated\s+(indoors?\s+and\s+outdoors?|indoors?|outdoors?)/i);
      if (envMatch) {
        const env = envMatch[1].toLowerCase();
        if (env.includes('indoor') && env.includes('outdoor')) {
          data.environment = 'both';
        } else if (env.includes('indoor')) {
          data.environment = 'indoor';
        } else if (env.includes('outdoor')) {
          data.environment = 'outdoor';
        }
      }
      
      // Extract structured fields from breeder description
      // Look for "Field: Value" patterns
      const fieldPatterns = [
        { pattern: /Yield:\s*([^\n<]+)/i, field: 'yieldd' },
        { pattern: /Harvest month:\s*([^\n<]+)/i, field: 'harvestMonth' },
        { pattern: /Height of the plant:\s*([^\n<]+)/i, field: 'plantHeight' },
        { pattern: /Genetic background:\s*([^\n<]+)/i, field: 'genetics' },
        { pattern: /Effect:\s*([^\n<]+)/i, field: 'effects' },
        { pattern: /Cannabinoid content:\s*([^\n<]+)/i, field: 'thc' },
        { pattern: /Flowering time:\s*([^\n<]+)/i, field: 'floweringTimeWeeks' },
        { pattern: /Type\s+(?:Indica|Sativa):\s*(\d+)%/i, field: 'typePercentage' }
      ];
      
      for (const { pattern, field } of fieldPatterns) {
        const match = fullText.match(pattern);
        if (match) {
          const value = match[1].trim();
          if (field === 'yieldd') {
            data.yieldd = value;
          } else if (field === 'harvestMonth') {
            data.harvestMonth = value;
          } else if (field === 'plantHeight') {
            data.plantHeight = value;
          } else if (field === 'effects') {
            data.effects = value;
          } else if (field === 'thc') {
            data.thc = value;
          } else if (field === 'floweringTimeWeeks' && !data.floweringTime) {
            // Convert weeks to days if we don't have days already
            const weekMatch = value.match(/(\d+)(?:-(\d+))?\s*weeks?/i);
            if (weekMatch) {
              const minWeeks = parseInt(weekMatch[1]);
              const maxWeeks = weekMatch[2] ? parseInt(weekMatch[2]) : minWeeks;
              data.floweringTime = String(Math.round((minWeeks + maxWeeks) / 2 * 7));
            }
          } else if (field === 'typePercentage') {
            const percent = parseInt(value);
            if (percent >= 70) {
              // If type is 70%+, use that as the strain type
              const typeMatch = fullText.match(/Type\s+(Indica|Sativa):\s*\d+%/i);
              if (typeMatch) {
                data.strainType = typeMatch[1].toLowerCase();
              }
            }
          }
        }
      }
    }

    return data;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
