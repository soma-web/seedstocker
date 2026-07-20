import { sqlite } from '../db.js';
import { triggerScrape, scraperStatus, logMessage } from '../scraper.js';
import { startSanityCheck, sanityCheckStatus } from '../sanity-check.js';
import { getScraperByDomain } from '../scrapers/registry.js';

export default async function scraperRoutes(app) {

  // ── Shop scraper routes ──────────────────────────────────────────────────
  app.post('/api/scrape', {
    schema: {
      body: {
        type: 'object',
        properties: {
          shop: { type: 'string' },
          mode: { type: 'string', enum: ['price', 'metadata'] }
        }
      }
    }
  }, async (req, reply) => {
    if (scraperStatus.isScanning) {
      return reply.status(409).send({ error: 'Scraper task already running' });
    }

    const { shop, mode } = req.body || {};

    // Fire and forget background scrape
    triggerScrape(shop, mode || 'price').catch(err => {
      logMessage('error', `Unhandled background scrape error: ${err.message}`);
    });

    return { success: true, message: 'Scraper task started in the background.' };
  });

  app.get('/api/scrape/status', async (req, reply) => {
    return scraperStatus;
  });

  // ── Single page scrape ───────────────────────────────────────────────────
  app.post('/api/scrape/single', {
    schema: {
      body: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', minLength: 1 },
          mode: { type: 'string', enum: ['price', 'metadata'] }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { url, mode } = req.body;

      const scrapeMode = mode || 'metadata';

      // Use registry instead of if/else chain (issue #5)
      const entry = getScraperByDomain(url);
      if (!entry) {
        const supported = (await import('../scrapers/registry.js')).SCRAPER_REGISTRY
          .map(e => e.name).join(', ');
        return reply.status(400).send({
          error: `Unsupported URL. Supported shops: ${supported}`
        });
      }

      const scraper = new entry.ScraperClass(logMessage, scrapeMode);

      logMessage('info', `On-demand single page scrape triggered for: ${url}`);
      const result = await scraper.scrapeSingle(url);
      logMessage('success', `Single page scrape successful: parsed "${result.name}" by "${result.breeder}" with ${result.offersCreated} offers.`);
      return result;
    } catch (err) {
      logMessage('error', `Single page scrape failed: ${err.message}`);
      reply.status(500).send({ error: err.message });
    }
  });

  // ── Sanity check ─────────────────────────────────────────────────────────
  app.post('/api/scrape/sanity-check', {
    schema: {
      body: {
        type: 'object',
        required: ['shop'],
        properties: {
          shop: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { shop } = req.body;
      await startSanityCheck(shop);
      return { success: true, message: `Sanity check started for ${shop}` };
    } catch (err) {
      reply.status(400).send({ error: err.message });
    }
  });

  app.get('/api/scrape/sanity-check/status', async (req, reply) => {
    return sanityCheckStatus;
  });

  // ── Seedfinder.eu enrichment ─────────────────────────────────────────────
  const seedfinderStatus = {
    isScanning: false,
    startTime: null,
    endTime: null,
    currentProduct: null,
    productsScraped: 0,
    logs: []
  };

  function seedfinderLogMessage(type, message) {
    const time = new Date().toISOString();
    const logLine = `[${time}][Seedfinder][${type.toUpperCase()}] ${message}`;
    console.log(logLine);

    seedfinderStatus.logs.push({ type, message, timestamp: time });
    if (seedfinderStatus.logs.length > 200) {
      seedfinderStatus.logs.shift();
    }
  }

  app.post('/api/seedfinder-scrape', async (req, reply) => {
    try {
      if (seedfinderStatus.isScanning) {
        return reply.status(409).send({ error: 'Seedfinder scraper is already running' });
      }

      seedfinderStatus.isScanning = true;
      seedfinderStatus.startTime = new Date().toISOString();
      seedfinderStatus.endTime = null;
      seedfinderStatus.productsScraped = 0;
      seedfinderStatus.logs = [];

      seedfinderLogMessage('info', 'Starting Seedfinder.eu metadata enrichment...');

      const { SeedfinderScraper } = await import('../scrapers/SeedfinderScraper.js');
      const scraper = new SeedfinderScraper(seedfinderLogMessage);

      scraper.scrape(seedfinderStatus).then(() => {
        seedfinderStatus.isScanning = false;
        seedfinderStatus.endTime = new Date().toISOString();
        seedfinderLogMessage('success', 'Seedfinder scraping complete');
      }).catch(err => {
        seedfinderStatus.isScanning = false;
        seedfinderStatus.endTime = new Date().toISOString();
        seedfinderLogMessage('error', `Scraper failed: ${err.message}`);
      });

      return { success: true, message: 'Seedfinder scraper started' };
    } catch (err) {
      seedfinderStatus.isScanning = false;
      seedfinderLogMessage('error', `Failed to start scraper: ${err.message}`);
      reply.status(500).send({ error: err.message });
    }
  });

  app.get('/api/seedfinder-scrape/status', async (req, reply) => {
    return seedfinderStatus;
  });

  app.post('/api/seedfinder-scrape/test', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'breeder'],
        properties: {
          name: { type: 'string', minLength: 1 },
          breeder: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { name, breeder } = req.body;

      const { SeedfinderScraper } = await import('../scrapers/SeedfinderScraper.js');
      const scraper = new SeedfinderScraper(seedfinderLogMessage);

      seedfinderLogMessage('info', `Testing lookup for: ${name} (${breeder})`);

      const result = await scraper.scrapeStrain({ id: 'test', name, breeder, strainType: null, floweringTime: null, seedType: null, environment: null, thc: null, cbd: null, plantHeight: null, harvestMonth: null, genetics: null, effects: null, rating: null, yieldd: null, image: null, seedfinderUrl: null });

      if (!result) {
        const searchResults = await scraper.searchStrains(name);
        return { found: false, results: searchResults };
      }

      return { found: true, updates: result };
    } catch (err) {
      reply.status(500).send({ error: err.message });
    }
  });
}
