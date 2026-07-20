import { sqlite } from '../db.js';
import { logMessage } from '../scraper.js';
import { SCRAPER_REGISTRY, getAllShopNames } from '../scrapers/registry.js';
import { getConfig, writeConfig } from '../config.js';

export default async function adminRoutes(app) {

  app.get('/api/config', async (req, reply) => {
    return getConfig();
  });

  app.post('/api/config', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: true
      }
    }
  }, async (req, reply) => {
    const current = getConfig();
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

      const dbFilePath = app.dbFilePath;
      let fileSize = '0.00 MB';
      try {
        const fs = await import('node:fs');
        if (fs.existsSync(dbFilePath)) {
          const stats = fs.statSync(dbFilePath);
          fileSize = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
        }
      } catch {}

      const shopStats = sqlite.prepare(`
        SELECT shop, COUNT(DISTINCT strain_id) AS strainsCount, COUNT(*) AS offersCount
        FROM scraped_offers
        GROUP BY shop
      `).all();

      // Build default shops from registry so all shops always appear
      const defaultShops = {};
      for (const name of getAllShopNames()) {
        defaultShops[name] = { strainsCount: 0, offersCount: 0 };
      }

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

  app.post('/api/db/clear-shop', {
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

      sqlite.transaction(() => {
        sqlite.prepare('DELETE FROM scraped_offers WHERE shop = ?').run(shop);
        sqlite.prepare('DELETE FROM price_history WHERE shop = ?').run(shop);
        // NOTE: Strains are NEVER deleted here — only offers and price history are removed.
        // Strains are a curated catalogue and must survive shop resets / re-scrapes.
      })();

      logMessage('success', `Cleared all database entries for shop: ${shop}`);
      return { success: true, message: `All entries for ${shop} cleared.` };
    } catch (err) {
      reply.status(500).send({ error: err.message });
    }
  });

  // Secured: read-only SQL query endpoint (issue #1)
  app.post('/api/db/query', {
    schema: {
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { query } = req.body;
      const trimmed = query.trim().toLowerCase();

      // Whitelist: only allow SELECT and PRAGMA statements
      const isAllowed = trimmed.startsWith('select') || trimmed.startsWith('pragma');
      if (!isAllowed) {
        return reply.status(403).send({
          error: 'Only SELECT and PRAGMA queries are allowed. Write operations are blocked for security.'
        });
      }

      const rows = sqlite.prepare(query).all();
      return { rows, type: 'select' };
    } catch (err) {
      reply.status(400).send({ error: err.message });
    }
  });
}
