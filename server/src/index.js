import fastify from 'fastify';
import cors from '@fastify/cors';
import fstatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sqlite } from './db.js';
import { triggerScrape, scraperStatus, logMessage } from './scraper.js';
import { HouseOfSeedsScraper } from './scrapers/HouseOfSeedsScraper.js';
import { ZamnesiaScraper } from './scrapers/ZamnesiaScraper.js';
import { HansBrainfoodScraper } from './scrapers/HansBrainfoodScraper.js';
import { GasStationCoScraper } from './scrapers/GasStationCoScraper.js';
import { startSanityCheck, sanityCheckStatus } from './sanity-check.js';
import { rewriteDescriptionToProse } from './rewriter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema manually for simplicity and speed
logMessage('info', 'Initializing database tables...');
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS strains (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    breeder TEXT,
    type TEXT,
    seed_type TEXT,
    thc TEXT,
    cbd TEXT,
    strain_type TEXT,
    flowering_time TEXT,
    flowering_min INTEGER,
    flowering_max INTEGER,
    environment TEXT,
    plant_height TEXT,
    harvest_month TEXT,
    effects TEXT,
    rating REAL,
    seedfinder_url TEXT,
    yield TEXT,
    genetics TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scraped_offers (
    id TEXT PRIMARY KEY,
    strain_id TEXT NOT NULL,
    shop TEXT NOT NULL,
    url TEXT NOT NULL,
    seeds INTEGER NOT NULL,
    price REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    availability TEXT NOT NULL DEFAULT 'available',
    fetched_at TEXT NOT NULL,
    FOREIGN KEY (strain_id) REFERENCES strains(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS price_history (
    id TEXT PRIMARY KEY,
    strain_id TEXT NOT NULL,
    shop TEXT NOT NULL,
    seeds INTEGER NOT NULL,
    price REAL NOT NULL,
    fetched_at TEXT NOT NULL,
    FOREIGN KEY (strain_id) REFERENCES strains(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS strain_shop_descriptions (
    strain_id TEXT NOT NULL,
    shop TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (strain_id, shop),
    FOREIGN KEY (strain_id) REFERENCES strains(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS rewritten_descriptions (
    strain_id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (strain_id) REFERENCES strains(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS ai_descriptions (
    strain_id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    model_used TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (strain_id) REFERENCES strains(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_strains_name_breeder ON strains(name, breeder);
  CREATE INDEX IF NOT EXISTS idx_scraped_offers_strain ON scraped_offers(strain_id);
  CREATE INDEX IF NOT EXISTS idx_price_history_strain ON price_history(strain_id);
  CREATE INDEX IF NOT EXISTS idx_strain_shop_descriptions_strain ON strain_shop_descriptions(strain_id);
`);
try {
  sqlite.exec("ALTER TABLE scraped_offers ADD COLUMN availability TEXT NOT NULL DEFAULT 'available'");
} catch (err) {
  // Column already exists or table doesn't exist yet, safe to ignore
}
try {
  sqlite.exec("ALTER TABLE strains ADD COLUMN thc TEXT");
} catch (err) {}
try {
  sqlite.exec("ALTER TABLE strains ADD COLUMN cbd TEXT");
} catch (err) {}
try {
  sqlite.exec("ALTER TABLE strains ADD COLUMN strain_type TEXT");
} catch (err) {}
try {
  sqlite.exec("ALTER TABLE strains ADD COLUMN flowering_time TEXT");
} catch (err) {}
try {
  sqlite.exec("ALTER TABLE strains ADD COLUMN flowering_min INTEGER");
} catch (err) {}
try {
  sqlite.exec("ALTER TABLE strains ADD COLUMN flowering_max INTEGER");
} catch (err) {}
try {
  sqlite.exec("ALTER TABLE strains ADD COLUMN environment TEXT");
} catch (err) {}
try {
  sqlite.exec("ALTER TABLE strains ADD COLUMN plant_height TEXT");
} catch (err) {}
try {
  sqlite.exec("ALTER TABLE strains ADD COLUMN harvest_month TEXT");
} catch (err) {}
try {
  sqlite.exec("ALTER TABLE strains ADD COLUMN effects TEXT");
} catch (err) {}
try {
  sqlite.exec("ALTER TABLE strains ADD COLUMN rating REAL");
} catch (err) {}
try {
  sqlite.exec("ALTER TABLE strains ADD COLUMN seedfinder_url TEXT");
} catch (err) {}
try {
  sqlite.exec("ALTER TABLE strains ADD COLUMN yield TEXT");
} catch (err) {}
try {
  sqlite.exec("ALTER TABLE strains ADD COLUMN genetics TEXT");
} catch (err) {}
logMessage('success', 'Database tables are ready.');

const configPath = path.resolve(__dirname, '../config/scraper.json');
const dbFilePath = path.resolve(__dirname, '../data/seedstocker.db');

function readConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch {}
  return { maxItemsPerShop: null, debug: false };
}

function writeConfig(data) {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

function getDbSize() {
  try {
    if (fs.existsSync(dbFilePath)) {
      const stats = fs.statSync(dbFilePath);
      return (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
    }
  } catch {}
  return '0.00 MB';
}

const app = fastify({ logger: false });

// Enable CORS
await app.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// Serve frontend build static files if they exist (production)
const distPath = path.resolve(__dirname, '../../dist');
if (fs.existsSync(distPath)) {
  logMessage('info', `Serving production static files from: ${distPath}`);
  app.register(fstatic, {
    root: path.join(distPath, 'assets'),
    prefix: '/assets/'
  });
  
  const serveIndex = (req, reply) => {
    reply.type('text/html').send(fs.readFileSync(path.join(distPath, 'index.html')));
  };

  app.get('/', serveIndex);
  app.get('/admin', serveIndex);
  app.get('/descriptions', serveIndex);
  app.get('/rewritten-descriptions', serveIndex);
  app.get('/strain/*', serveIndex);
}

// API Routes
app.get('/api/strains', async (req, reply) => {
  const { search, type, seedType, breeder } = req.query;
  
  let sql = `
    SELECT 
      s.id AS strainId, s.name AS strainName, s.breeder, s.type, s.seed_type AS seedType,
      s.thc, s.cbd, s.strain_type AS strainType, s.flowering_time AS floweringTime,
      s.flowering_min AS floweringMin, s.flowering_max AS floweringMax,
      o.id AS offerId, o.shop, o.url, o.seeds, o.price, o.currency, o.availability, o.fetched_at AS fetchedAt
    FROM strains s
    LEFT JOIN scraped_offers o ON s.id = o.strain_id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (search) {
    sql += ` AND (s.name LIKE ? OR s.breeder LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  
  if (type) {
    sql += ` AND s.type = ?`;
    params.push(type);
  }
  
  if (seedType) {
    sql += ` AND s.seed_type = ?`;
    params.push(seedType);
  }
  
  if (breeder) {
    sql += ` AND s.breeder = ?`;
    params.push(breeder);
  }
  
  sql += ` ORDER BY s.name ASC, o.seeds ASC, o.price ASC`;
  
  try {
    const descRows = sqlite.prepare('SELECT strain_id AS strainId, shop, description FROM strain_shop_descriptions').all();
    const descriptionsByStrain = {};
    for (const d of descRows) {
      if (!descriptionsByStrain[d.strainId]) {
        descriptionsByStrain[d.strainId] = [];
      }
      descriptionsByStrain[d.strainId].push({ shop: d.shop, description: d.description });
    }

    const rewrittenRows = sqlite.prepare('SELECT strain_id AS strainId, description FROM rewritten_descriptions').all();
    const rewrittenByStrain = {};
    for (const rw of rewrittenRows) {
      rewrittenByStrain[rw.strainId] = rw.description;
    }

    const aiRows = sqlite.prepare('SELECT strain_id AS strainId, description, model_used AS modelUsed FROM ai_descriptions').all();
    const aiByStrain = {};
    for (const ai of aiRows) {
      aiByStrain[ai.strainId] = { description: ai.description, modelUsed: ai.modelUsed };
    }

    const rows = sqlite.prepare(sql).all(...params);
    
    // Group rows by strain
    const strainsMap = new Map();
    for (const r of rows) {
      if (!strainsMap.has(r.strainId)) {
        strainsMap.set(r.strainId, {
          id: r.strainId,
          name: r.strainName,
          breeder: r.breeder,
          type: r.type,
          seedType: r.seedType,
          thc: r.thc,
          cbd: r.cbd,
          strainType: r.strainType,
          floweringTime: r.floweringTime,
          floweringMin: r.floweringMin,
          floweringMax: r.floweringMax,
          descriptions: descriptionsByStrain[r.strainId] || [],
          rewrittenDescription: rewrittenByStrain[r.strainId] || null,
          aiDescription: aiByStrain[r.strainId] || null,
          offers: []
        });
      }
      if (r.offerId) {
        strainsMap.get(r.strainId).offers.push({
          id: r.offerId,
          shop: r.shop,
          url: r.url,
          seeds: r.seeds,
          price: r.price,
          currency: r.currency,
          breeder: r.breeder,
          availability: r.availability || 'available',
          fetchedAt: r.fetchedAt
        });
      }
    }
    
    return Array.from(strainsMap.values());
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
});

app.get('/api/strains/:id/detail', async (req, reply) => {
  try {
    const { id } = req.params;
    const strain = sqlite.prepare('SELECT * FROM strains WHERE id = ?').get(id);
    if (!strain) return reply.status(404).send({ error: 'Strain not found' });
    const offers = sqlite.prepare(`
      SELECT id, shop, url, seeds, price, currency, availability, fetched_at AS fetchedAt
      FROM scraped_offers WHERE strain_id = ?
      ORDER BY shop ASC, seeds ASC, price ASC
    `).all(id);

    // Find other strains with the same name but different breeders
    const siblings = sqlite.prepare(`
      SELECT id, breeder
      FROM strains
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ?
      ORDER BY breeder ASC
    `).all(strain.name, id);

    const descriptions = sqlite.prepare(`
      SELECT shop, description
      FROM strain_shop_descriptions
      WHERE strain_id = ?
    `).all(id);

    const rewritten = sqlite.prepare(`
      SELECT description
      FROM rewritten_descriptions
      WHERE strain_id = ?
    `).get(id);

    const aiDesc = sqlite.prepare(`
      SELECT description, model_used AS modelUsed
      FROM ai_descriptions
      WHERE strain_id = ?
    `).get(id);

    return {
      id: strain.id,
      name: strain.name,
      breeder: strain.breeder,
      type: strain.type,
      seedType: strain.seed_type,
      thc: strain.thc,
      cbd: strain.cbd,
      strainType: strain.strain_type,
      floweringTime: strain.flowering_time,
      floweringMin: strain.flowering_min,
      floweringMax: strain.flowering_max,
      createdAt: strain.created_at,
      updatedAt: strain.updated_at,
      descriptions,
      rewrittenDescription: rewritten ? rewritten.description : null,
      aiDescription: aiDesc ? { description: aiDesc.description, modelUsed: aiDesc.modelUsed } : null,
      offers,
      siblings
    };
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
});

// Generate AI description for a single strain (separate on-demand process)
app.post('/api/strains/:id/generate-ai-description', async (req, reply) => {
  try {
    const { id } = req.params;
    const strain = sqlite.prepare('SELECT * FROM strains WHERE id = ?').get(id);
    if (!strain) return reply.status(404).send({ error: 'Strain not found' });

    // Get the best available raw shop description to use as context
    const shopDesc = sqlite.prepare(`
      SELECT description FROM strain_shop_descriptions
      WHERE strain_id = ?
      ORDER BY rowid DESC LIMIT 1
    `).get(id);

    const originalText = shopDesc ? shopDesc.description : '';

    const strainObj = {
      name: strain.name,
      breeder: strain.breeder,
      type: strain.type,
      strainType: strain.strain_type,
      thc: strain.thc,
      cbd: strain.cbd,
      floweringTime: strain.flowering_time
    };

    const result = await rewriteDescriptionToProse(originalText, strainObj);
    if (!result || !result.description) {
      return reply.status(503).send({ error: 'AI generation failed. Check that the local LLM or Gemini API key is configured.' });
    }

    const { description, isAi, modelUsed } = result;
    const now = new Date().toISOString();

    if (isAi) {
      // Save to ai_descriptions table
      const existing = sqlite.prepare('SELECT strain_id FROM ai_descriptions WHERE strain_id = ?').get(id);
      if (existing) {
        sqlite.prepare('UPDATE ai_descriptions SET description = ?, model_used = ?, updated_at = ? WHERE strain_id = ?')
          .run(description, modelUsed, now, id);
      } else {
        sqlite.prepare('INSERT INTO ai_descriptions (strain_id, description, model_used, updated_at) VALUES (?, ?, ?, ?)')
          .run(id, description, modelUsed, now);
      }
    } else {
      // Fallback: save template result to rewritten_descriptions
      const existing = sqlite.prepare('SELECT strain_id FROM rewritten_descriptions WHERE strain_id = ?').get(id);
      if (existing) {
        sqlite.prepare('UPDATE rewritten_descriptions SET description = ?, updated_at = ? WHERE strain_id = ?')
          .run(description, now, id);
      } else {
        sqlite.prepare('INSERT INTO rewritten_descriptions (strain_id, description, updated_at) VALUES (?, ?, ?)')
          .run(id, description, now);
      }
    }

    return { success: true, isAi, modelUsed: modelUsed || null, description };
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
});

app.delete('/api/strains/:id', async (req, reply) => {
  try {
    const { id } = req.params;
    const strain = sqlite.prepare('SELECT id, name FROM strains WHERE id = ?').get(id);
    if (!strain) return reply.status(404).send({ error: 'Strain not found' });

    sqlite.transaction(() => {
      sqlite.prepare('DELETE FROM scraped_offers WHERE strain_id = ?').run(id);
      sqlite.prepare('DELETE FROM price_history WHERE strain_id = ?').run(id);
      sqlite.prepare('DELETE FROM strain_shop_descriptions WHERE strain_id = ?').run(id);
      sqlite.prepare('DELETE FROM rewritten_descriptions WHERE strain_id = ?').run(id);
      sqlite.prepare('DELETE FROM ai_descriptions WHERE strain_id = ?').run(id);
      sqlite.prepare('DELETE FROM strains WHERE id = ?').run(id);
    })();

    logMessage('success', `Deleted strain: ${strain.name} (${id})`);
    return { success: true, message: `Strain "${strain.name}" deleted.` };
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
});

app.get('/api/strains/:id/price-history', async (req, reply) => {
  try {
    const { id } = req.params;
    const rows = sqlite.prepare(`
      SELECT * FROM price_history
      WHERE strain_id = ?
      ORDER BY fetched_at DESC
    `).all(id);
    return rows;
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
});

app.get('/api/breeders', async (req, reply) => {
  try {
    const rows = sqlite.prepare(`
      SELECT DISTINCT breeder 
      FROM strains 
      WHERE breeder IS NOT NULL 
      ORDER BY breeder ASC
    `).all();
    return rows.map(r => r.breeder);
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
});

app.post('/api/scrape', async (req, reply) => {
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

app.get('/api/config', async (req, reply) => {
  return readConfig();
});

app.post('/api/config', async (req, reply) => {
  const current = readConfig();
  const updated = { ...current, ...req.body };
  const ok = writeConfig(updated);
  if (!ok) {
    return reply.status(500).send({ error: 'Failed to write config' });
  }
  return updated;
});

app.get('/api/db/stats', async (req, reply) => {
  try {
    const strainsCount = sqlite.prepare('SELECT COUNT(*) AS count FROM strains').get().count;
    const offersCount = sqlite.prepare('SELECT COUNT(*) AS count FROM scraped_offers').get().count;
    const fileSize = getDbSize();
    
    const shopStats = sqlite.prepare(`
      SELECT shop, COUNT(DISTINCT strain_id) AS strainsCount, COUNT(*) AS offersCount
      FROM scraped_offers
      GROUP BY shop
    `).all();

    const defaultShops = {
      'Zamnesia': { strainsCount: 0, offersCount: 0 },
      'House of Seeds': { strainsCount: 0, offersCount: 0 },
      'Hans Brainfood': { strainsCount: 0, offersCount: 0 },
      'Gas Station Co. Seeds': { strainsCount: 0, offersCount: 0 }
    };
    
    shopStats.forEach(s => {
      defaultShops[s.shop] = { strainsCount: s.strainsCount, offersCount: s.offersCount };
    });
    
    const mergedShopStats = Object.entries(defaultShops).map(([shop, stats]) => ({
      shop,
      strainsCount: stats.strainsCount,
      offersCount: stats.offersCount
    }));

    return { strainsCount, offersCount, fileSize, dbPath: dbFilePath, shopStats: mergedShopStats };
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
});

app.get('/api/db/strains', async (req, reply) => {
  try {
    const rows = sqlite.prepare('SELECT * FROM strains ORDER BY name ASC').all();
    return rows;
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
});

app.post('/api/db/reset', async (req, reply) => {
  try {
    sqlite.exec(`
      DELETE FROM strains;
      DELETE FROM scraped_offers;
      DELETE FROM price_history;
      VACUUM;
    `);
    return { success: true, message: 'Database reset and vacuumed successfully.' };
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
});

app.post('/api/db/clear-shop', async (req, reply) => {
  try {
    const { shop } = req.body || {};
    if (!shop) {
      return reply.status(400).send({ error: 'No shop name provided.' });
    }

    sqlite.transaction(() => {
      sqlite.prepare('DELETE FROM scraped_offers WHERE shop = ?').run(shop);
      sqlite.prepare('DELETE FROM price_history WHERE shop = ?').run(shop);
      sqlite.prepare('DELETE FROM strains WHERE id NOT IN (SELECT DISTINCT strain_id FROM scraped_offers)').run();
    })();

    logMessage('success', `Cleared all database entries for shop: ${shop}`);
    return { success: true, message: `All entries for ${shop} cleared.` };
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
});

app.post('/api/db/query', async (req, reply) => {
  try {
    const { query } = req.body || {};
    if (!query) {
      return reply.status(400).send({ error: 'No SQL query statement provided.' });
    }
    
    const isSelect = query.trim().toLowerCase().startsWith('select') || 
                     query.trim().toLowerCase().startsWith('pragma');
                     
    if (isSelect) {
      const rows = sqlite.prepare(query).all();
      return { rows, type: 'select' };
    } else {
      const result = sqlite.prepare(query).run();
      return { result, type: 'write' };
    }
  } catch (err) {
    reply.status(400).send({ error: err.message });
  }
});

app.post('/api/scrape/single', async (req, reply) => {
  try {
    const { url, mode } = req.body || {};
    if (!url) {
      return reply.status(400).send({ error: 'No URL provided' });
    }
    
    const scrapeMode = mode || 'metadata';
    let scraper;
    if (url.includes('zamnesia.de')) {
      scraper = new ZamnesiaScraper(logMessage, scrapeMode);
    } else if (url.includes('house-of-seeds.de')) {
      scraper = new HouseOfSeedsScraper(logMessage, scrapeMode);
    } else if (url.includes('hansbrainfood.de')) {
      scraper = new HansBrainfoodScraper(logMessage, scrapeMode);
    } else if (url.includes('gasstationcoseeds.de')) {
      scraper = new GasStationCoScraper(logMessage, scrapeMode);
    } else {
      return reply.status(400).send({ error: 'Unsupported URL. Only Zamnesia, House of Seeds, Hans Brainfood, and Gas Station Co. Seeds product links are supported.' });
    }
    
    logMessage('info', `On-demand single page scrape triggered for: ${url}`);
    const result = await scraper.scrapeSingle(url);
    logMessage('success', `Single page scrape successful: parsed "${result.name}" by "${result.breeder}" with ${result.offersCreated} offers.`);
    return result;
  } catch (err) {
    logMessage('error', `Single page scrape failed: ${err.message}`);
    reply.status(500).send({ error: err.message });
  }
});

app.post('/api/scrape/sanity-check', async (req, reply) => {
  try {
    const { shop } = req.body || {};
    if (!shop) {
      return reply.status(400).send({ error: 'No shop name provided.' });
    }
    
    await startSanityCheck(shop);
    return { success: true, message: `Sanity check started for ${shop}` };
  } catch (err) {
    reply.status(400).send({ error: err.message });
  }
});

app.get('/api/scrape/sanity-check/status', async (req, reply) => {
  return sanityCheckStatus;
});

// Seedfinder.eu scraper routes
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

    const { SeedfinderScraper } = await import('./scrapers/SeedfinderScraper.js');
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

app.post('/api/seedfinder-scrape/test', async (req, reply) => {
  try {
    const { name, breeder } = req.body || {};
    if (!name || !breeder) {
      return reply.status(400).send({ error: 'Name and breeder are required' });
    }

    const { SeedfinderScraper } = await import('./scrapers/SeedfinderScraper.js');
    const scraper = new SeedfinderScraper(seedfinderLogMessage);

    seedfinderLogMessage('info', `Testing lookup for: ${name} (${breeder})`);

    // Use the scraper's improved search strategy
    const result = await scraper.scrapeStrain({ id: 'test', name, breeder, strainType: null, floweringTime: null, seedType: null, environment: null, thc: null, cbd: null, plantHeight: null, harvestMonth: null, genetics: null, effects: null, rating: null, yieldd: null, image: null, seedfinderUrl: null });
    
    if (!result) {
      // Get search results for display
      const searchResults = await scraper.searchStrains(name);
      return { found: false, results: searchResults };
    }

    return { found: true, updates: result };
  } catch (err) {
    reply.status(500).send({ error: err.message });
  }
});

// Bulk AI Description Generation state
const bulkAiStatus = {
  isScanning: false,
  startTime: null,
  endTime: null,
  totalStrains: 0,
  processedStrains: 0,
  currentStrain: null,
  logs: [],
  cancelRequested: false
};

function bulkAiLogMessage(type, message) {
  const time = new Date().toISOString();
  const logLine = `[${time}][BulkAI][${type.toUpperCase()}] ${message}`;
  console.log(logLine);
  
  bulkAiStatus.logs.push({ type, message, timestamp: time });
  if (bulkAiStatus.logs.length > 200) {
    bulkAiStatus.logs.shift();
  }
}

async function runBulkAiDescriptions(allStrains) {
  for (let i = 0; i < allStrains.length; i++) {
    if (bulkAiStatus.cancelRequested) {
      bulkAiLogMessage('warning', 'Bulk AI description generation cancelled by user.');
      break;
    }
    
    const strain = allStrains[i];
    bulkAiStatus.currentStrain = strain.name;
    
    try {
      // 1. Get description context
      const shopDesc = sqlite.prepare(`
        SELECT description FROM strain_shop_descriptions
        WHERE strain_id = ?
        ORDER BY rowid DESC LIMIT 1
      `).get(strain.id);
      
      const originalText = shopDesc ? shopDesc.description : '';
      const strainObj = {
        name: strain.name,
        breeder: strain.breeder,
        type: strain.type,
        strainType: strain.strain_type,
        thc: strain.thc,
        cbd: strain.cbd,
        floweringTime: strain.flowering_time
      };
      
      // 2. Call rewrite
      const result = await rewriteDescriptionToProse(originalText, strainObj);
      if (result && result.description) {
        const { description, isAi, modelUsed } = result;
        const now = new Date().toISOString();
        
        if (isAi) {
          const existing = sqlite.prepare('SELECT strain_id FROM ai_descriptions WHERE strain_id = ?').get(strain.id);
          if (existing) {
            sqlite.prepare('UPDATE ai_descriptions SET description = ?, model_used = ?, updated_at = ? WHERE strain_id = ?')
              .run(description, modelUsed, now, strain.id);
          } else {
            sqlite.prepare('INSERT INTO ai_descriptions (strain_id, description, model_used, updated_at) VALUES (?, ?, ?, ?)')
              .run(strain.id, description, modelUsed, now);
          }
          bulkAiLogMessage('success', `[${i + 1}/${allStrains.length}] ${strain.name} - Generated AI description (${modelUsed})`);
        } else {
          const existing = sqlite.prepare('SELECT strain_id FROM rewritten_descriptions WHERE strain_id = ?').get(strain.id);
          if (existing) {
            sqlite.prepare('UPDATE rewritten_descriptions SET description = ?, updated_at = ? WHERE strain_id = ?')
              .run(description, now, strain.id);
          } else {
            sqlite.prepare('INSERT INTO rewritten_descriptions (strain_id, description, updated_at) VALUES (?, ?, ?)')
              .run(strain.id, description, now);
          }
          bulkAiLogMessage('info', `[${i + 1}/${allStrains.length}] ${strain.name} - Generated fallback template description`);
        }
      } else {
        bulkAiLogMessage('error', `[${i + 1}/${allStrains.length}] ${strain.name} - Generation failed (no result)`);
      }
    } catch (err) {
      bulkAiLogMessage('error', `[${i + 1}/${allStrains.length}] ${strain.name} - Error: ${err.message}`);
    }
    
    bulkAiStatus.processedStrains = i + 1;
    // Yield event loop and avoid slamming the API
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  bulkAiStatus.isScanning = false;
  bulkAiStatus.endTime = new Date().toISOString();
  bulkAiStatus.currentStrain = null;
  if (!bulkAiStatus.cancelRequested) {
    bulkAiLogMessage('success', 'Bulk AI description generation completed successfully.');
  }
}

app.post('/api/strains/generate-ai-descriptions', async (req, reply) => {
  try {
    if (bulkAiStatus.isScanning) {
      return reply.status(409).send({ error: 'Bulk AI generation is already running' });
    }

    const allStrains = sqlite.prepare(`
      SELECT s.* FROM strains s
      LEFT JOIN ai_descriptions a ON s.id = a.strain_id
      WHERE a.strain_id IS NULL
    `).all();
    if (allStrains.length === 0) {
      return reply.status(400).send({ error: 'All strains in the database already have AI descriptions.' });
    }

    bulkAiStatus.isScanning = true;
    bulkAiStatus.startTime = new Date().toISOString();
    bulkAiStatus.endTime = null;
    bulkAiStatus.totalStrains = allStrains.length;
    bulkAiStatus.processedStrains = 0;
    bulkAiStatus.currentStrain = null;
    bulkAiStatus.logs = [];
    bulkAiStatus.cancelRequested = false;

    bulkAiLogMessage('info', `Starting bulk AI description generation for ${allStrains.length} strains...`);

    runBulkAiDescriptions(allStrains).catch(err => {
      bulkAiStatus.isScanning = false;
      bulkAiStatus.endTime = new Date().toISOString();
      bulkAiLogMessage('error', `Bulk run crashed: ${err.message}`);
    });

    return { success: true, message: 'Bulk AI description generation started' };
  } catch (err) {
    bulkAiStatus.isScanning = false;
    bulkAiLogMessage('error', `Failed to start bulk AI generation: ${err.message}`);
    reply.status(500).send({ error: err.message });
  }
});

app.get('/api/strains/generate-ai-descriptions/status', async (req, reply) => {
  return bulkAiStatus;
});

app.post('/api/strains/generate-ai-descriptions/stop', async (req, reply) => {
  if (!bulkAiStatus.isScanning) {
    return reply.status(400).send({ error: 'Bulk AI generation is not running' });
  }
  bulkAiStatus.cancelRequested = true;
  bulkAiLogMessage('info', 'Cancellation request received. Stopping generation...');
  return { success: true, message: 'Cancellation requested' };
});

// Fallback to index.html for React SPA router (for production build fallback)
app.setNotFoundHandler((req, reply) => {
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    return reply.sendFile('index.html');
  }
  reply.status(404).send({ error: 'Not Found' });
});

// Start fastify server
const port = 3002;
const start = async () => {
  try {
    await app.listen({ port, host: '0.0.0.0' });
    logMessage('success', `Fastify server running on http://localhost:${port}`);
  } catch (err) {
    logMessage('error', `Server startup failed: ${err.message}`);
    process.exit(1);
  }
};

start();
