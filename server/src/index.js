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
  CREATE INDEX IF NOT EXISTS idx_strains_name_breeder ON strains(name, breeder);
  CREATE INDEX IF NOT EXISTS idx_scraped_offers_strain ON scraped_offers(strain_id);
  CREATE INDEX IF NOT EXISTS idx_price_history_strain ON price_history(strain_id);
`);
try {
  sqlite.exec("ALTER TABLE scraped_offers ADD COLUMN availability TEXT NOT NULL DEFAULT 'available'");
} catch (err) {
  // Column already exists or table doesn't exist yet, safe to ignore
}
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
}

// API Routes
app.get('/api/strains', async (req, reply) => {
  const { search, type, seedType, breeder } = req.query;
  
  let sql = `
    SELECT 
      s.id AS strainId, s.name AS strainName, s.breeder, s.type, s.seed_type AS seedType,
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
  
  const { shop } = req.body || {};
  
  // Fire and forget background scrape
  triggerScrape(shop).catch(err => {
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
      'Hans Brainfood': { strainsCount: 0, offersCount: 0 }
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
    const { url } = req.body || {};
    if (!url) {
      return reply.status(400).send({ error: 'No URL provided' });
    }
    
    let scraper;
    if (url.includes('zamnesia.de')) {
      scraper = new ZamnesiaScraper(logMessage);
    } else if (url.includes('house-of-seeds.de')) {
      scraper = new HouseOfSeedsScraper(logMessage);
    } else if (url.includes('hansbrainfood.de')) {
      scraper = new HansBrainfoodScraper(logMessage);
    } else {
      return reply.status(400).send({ error: 'Unsupported URL. Only Zamnesia, House of Seeds, and Hans Brainfood product links are supported.' });
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
