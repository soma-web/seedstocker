import { sqlite } from '../db.js';
import { getConfig, writeConfig } from '../config.js';

function dedupeOffers(rows) {
  const deduped = new Map();

  for (const row of rows) {
    const key = [
      row.shop || '',
      row.url || '',
      row.seeds ?? '',
      row.price ?? '',
      row.currency || '',
      row.availability || ''
    ].join('|');

    const existing = deduped.get(key);
    if (!existing || new Date(row.fetchedAt).getTime() > new Date(existing.fetchedAt).getTime()) {
      deduped.set(key, row);
    }
  }

  return Array.from(deduped.values());
}

export default async function strainRoutes(app) {

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
      const rows = sqlite.prepare(sql).all(...params);

      // Collect matched strain IDs for targeted description loading (issue #11)
      const matchedStrainIds = new Set();
      for (const r of rows) {
        matchedStrainIds.add(r.strainId);
      }
      const idList = Array.from(matchedStrainIds);

      // Only load descriptions for matched strains instead of ALL descriptions
      const descriptionsByStrain = {};
      const rewrittenByStrain = {};
      const aiByStrain = {};

      if (idList.length > 0) {
        const placeholders = idList.map(() => '?').join(',');

        const descRows = sqlite.prepare(
          `SELECT strain_id AS strainId, shop, description FROM strain_shop_descriptions WHERE strain_id IN (${placeholders})`
        ).all(...idList);
        for (const d of descRows) {
          if (!descriptionsByStrain[d.strainId]) {
            descriptionsByStrain[d.strainId] = [];
          }
          descriptionsByStrain[d.strainId].push({ shop: d.shop, description: d.description });
        }

        const rewrittenRows = sqlite.prepare(
          `SELECT strain_id AS strainId, description FROM rewritten_descriptions WHERE strain_id IN (${placeholders})`
        ).all(...idList);
        for (const rw of rewrittenRows) {
          rewrittenByStrain[rw.strainId] = rw.description;
        }

        const aiRows = sqlite.prepare(
          `SELECT strain_id AS strainId, description, model_used AS modelUsed FROM ai_descriptions WHERE strain_id IN (${placeholders})`
        ).all(...idList);
        for (const ai of aiRows) {
          aiByStrain[ai.strainId] = { description: ai.description, modelUsed: ai.modelUsed };
        }
      }

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

      for (const strain of strainsMap.values()) {
        strain.offers = dedupeOffers(strain.offers).sort((a, b) => {
          if (a.shop !== b.shop) return a.shop.localeCompare(b.shop);
          if (Number(a.seeds) !== Number(b.seeds)) return Number(a.seeds) - Number(b.seeds);
          return Number(a.price) - Number(b.price);
        });
      }

      return Array.from(strainsMap.values());
    } catch (err) {
      reply.status(500).send({ error: err.message });
    }
  });

  const getStrainDetailHandler = async (req, reply) => {
    try {
      const { id } = req.params;
      const strain = sqlite.prepare('SELECT * FROM strains WHERE id = ?').get(id);
      if (!strain) return reply.status(404).send({ error: 'Strain not found' });
      const offers = dedupeOffers(sqlite.prepare(`
        SELECT id, shop, url, seeds, price, currency, availability, fetched_at AS fetchedAt
        FROM scraped_offers WHERE strain_id = ?
        ORDER BY shop ASC, seeds ASC, price ASC
      `).all(id)).sort((a, b) => {
        if (a.shop !== b.shop) return a.shop.localeCompare(b.shop);
        if (Number(a.seeds) !== Number(b.seeds)) return Number(a.seeds) - Number(b.seeds);
        return Number(a.price) - Number(b.price);
      });

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
        environment: strain.environment,
        plantHeight: strain.plant_height,
        harvestMonth: strain.harvest_month,
        effects: strain.effects,
        rating: strain.rating,
        seedfinderUrl: strain.seedfinder_url,
        harvestYield: strain.yield,
        genetics: strain.genetics,
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
  };

  app.get('/api/strains/:id/detail', getStrainDetailHandler);
  app.get('/api/strains/:id', getStrainDetailHandler);

  app.delete('/api/strains/:id', async (req, reply) => {
    try {
      const { id } = req.params;
      const blacklist = req.query.blacklist === 'true' || req.body?.blacklist === true;
      const strain = sqlite.prepare('SELECT id, name FROM strains WHERE id = ?').get(id);
      if (!strain) return reply.status(404).send({ error: 'Strain not found' });

      let blacklisted = false;
      if (blacklist && strain.name) {
        const config = getConfig();
        const currentBlocked = Array.isArray(config.blockedWords) ? config.blockedWords : [];
        const nameClean = strain.name.trim();
        const nameLower = nameClean.toLowerCase();
        if (nameClean && !currentBlocked.some(w => w.trim().toLowerCase() === nameLower)) {
          currentBlocked.push(nameClean);
          writeConfig({ ...config, blockedWords: currentBlocked });
          blacklisted = true;
        }
      }

      sqlite.transaction(() => {
        sqlite.prepare('UPDATE new_scraped_entries SET suggested_strain_id = NULL WHERE suggested_strain_id = ?').run(id);
        sqlite.prepare('DELETE FROM scraped_offers WHERE strain_id = ?').run(id);
        sqlite.prepare('DELETE FROM price_history WHERE strain_id = ?').run(id);
        sqlite.prepare('DELETE FROM strain_shop_descriptions WHERE strain_id = ?').run(id);
        sqlite.prepare('DELETE FROM rewritten_descriptions WHERE strain_id = ?').run(id);
        sqlite.prepare('DELETE FROM ai_descriptions WHERE strain_id = ?').run(id);
        sqlite.prepare('DELETE FROM strains WHERE id = ?').run(id);
      })();

      const message = blacklisted
        ? `Strain "${strain.name}" gelöscht und Name auf die Blacklist (Blocked Words) gesetzt.`
        : `Strain "${strain.name}" gelöscht.`;

      return { success: true, message, blacklisted };
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

  app.put('/api/strains/:id', async (req, reply) => {
    try {
      const { id } = req.params;
      const {
        name,
        breeder,
        type,
        seedType,
        thc,
        cbd,
        strainType,
        floweringTime,
        floweringMin,
        floweringMax,
        environment,
        plantHeight,
        harvestMonth,
        effects,
        rating,
        seedfinderUrl,
        harvestYield,
        genetics,
        rewrittenDescription
      } = req.body;

      const strain = sqlite.prepare('SELECT * FROM strains WHERE id = ?').get(id);
      if (!strain) return reply.status(404).send({ error: 'Strain not found' });

      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          return reply.status(400).send({ error: 'Strain name cannot be empty.' });
        }
      }

      sqlite.transaction(() => {
        // Update strain fields
        sqlite.prepare(`
          UPDATE strains
          SET name = ?,
              breeder = ?,
              type = ?,
              seed_type = ?,
              thc = ?,
              cbd = ?,
              strain_type = ?,
              flowering_time = ?,
              flowering_min = ?,
              flowering_max = ?,
              environment = ?,
              plant_height = ?,
              harvest_month = ?,
              effects = ?,
              rating = ?,
              seedfinder_url = ?,
              yield = ?,
              genetics = ?,
              updated_at = ?
          WHERE id = ?
        `).run(
          name !== undefined ? name : strain.name,
          breeder !== undefined ? breeder : strain.breeder,
          type !== undefined ? type : strain.type,
          seedType !== undefined ? seedType : strain.seed_type,
          thc !== undefined ? thc : strain.thc,
          cbd !== undefined ? cbd : strain.cbd,
          strainType !== undefined ? strainType : strain.strain_type,
          floweringTime !== undefined ? floweringTime : strain.flowering_time,
          floweringMin !== undefined && floweringMin !== null && floweringMin !== '' ? Number(floweringMin) : (floweringMin === null ? null : strain.flowering_min),
          floweringMax !== undefined && floweringMax !== null && floweringMax !== '' ? Number(floweringMax) : (floweringMax === null ? null : strain.flowering_max),
          environment !== undefined ? environment : strain.environment,
          plantHeight !== undefined ? plantHeight : strain.plant_height,
          harvestMonth !== undefined ? harvestMonth : strain.harvest_month,
          effects !== undefined ? effects : strain.effects,
          rating !== undefined && rating !== null && rating !== '' ? Number(rating) : (rating === null ? null : strain.rating),
          seedfinderUrl !== undefined ? seedfinderUrl : strain.seedfinder_url,
          harvestYield !== undefined ? harvestYield : strain.yield,
          genetics !== undefined ? genetics : strain.genetics,
          new Date().toISOString(),
          id
        );

        // Update or insert rewrittenDescription if provided
        if (rewrittenDescription !== undefined) {
          const existing = sqlite.prepare('SELECT 1 FROM rewritten_descriptions WHERE strain_id = ?').get(id);
          if (rewrittenDescription === null || rewrittenDescription.trim() === '') {
            if (existing) {
              sqlite.prepare('DELETE FROM rewritten_descriptions WHERE strain_id = ?').run(id);
            }
          } else {
            if (existing) {
              sqlite.prepare('UPDATE rewritten_descriptions SET description = ?, updated_at = ? WHERE strain_id = ?')
                .run(rewrittenDescription, new Date().toISOString(), id);
            } else {
              sqlite.prepare('INSERT INTO rewritten_descriptions (strain_id, description, updated_at) VALUES (?, ?, ?)')
                .run(id, rewrittenDescription, new Date().toISOString());
            }
          }
        }
      })();

      return { success: true, message: 'Strain updated successfully.' };
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
}
