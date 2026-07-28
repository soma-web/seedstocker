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
    const body = { ...req.body };
    if (body.port !== undefined) {
      const p = parseInt(body.port, 10);
      if (!isNaN(p) && p > 0) {
        body.port = p;
      }
    }
    const updated = { ...current, ...body };
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
      // Delete strains that do not have an AI description or custom/rewritten description
      sqlite.prepare(`
        DELETE FROM strains 
        WHERE id NOT IN (SELECT strain_id FROM ai_descriptions)
          AND id NOT IN (SELECT strain_id FROM rewritten_descriptions)
      `).run();
      
      // NOTE: scraped_offers and price_history are preserved
      sqlite.prepare('VACUUM').run();

      return { success: true, message: 'Database reset successfully. Retained strains with AI/custom descriptions, offers, and price history.' };
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

      // NOTE: Offers and price history are never deleted.
      logMessage('info', `Clear shop requested for ${shop} — offers and price history are preserved.`);
      return { success: true, message: `Offers and price history for ${shop} are preserved.` };
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
