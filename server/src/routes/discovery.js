import { sqlite } from '../db.js';
import { triggerScrape } from '../scraper.js';
import { getAllShopNames, getScraperByName } from '../scrapers/registry.js';
import crypto from 'node:crypto';

async function processOffersForStagedEntry(entry, strainId, now) {
  let offersAdded = 0;

  // 1. Immediately create offer from staged entry data if price > 0
  if (entry.price > 0) {
    const existingOffer = sqlite.prepare(
      'SELECT id FROM scraped_offers WHERE strain_id = ? AND shop = ? AND seeds = ?'
    ).get(strainId, entry.shop, entry.seeds || 1);

    if (!existingOffer) {
      const offerId = crypto.randomUUID();
      sqlite.prepare(`
        INSERT INTO scraped_offers (
          id, strain_id, shop, url, seeds, price, currency, availability, fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?)
      `).run(
        offerId,
        strainId,
        entry.shop,
        entry.shop_product_url || '',
        entry.seeds || 1,
        entry.price,
        entry.currency || 'EUR',
        now
      );
      offersAdded++;
    }

    // Record price history
    sqlite.prepare(`
      INSERT INTO price_history (id, strain_id, shop, seeds, price, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), strainId, entry.shop, entry.seeds || 1, entry.price, now);
  }

  // 2. If price is missing (0) or if entry has product URL, try fast HTML variant fetch (with 3s timeout)
  if (offersAdded === 0 && entry.shop_product_url) {
    try {
      const res = await fetch(entry.shop_product_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const html = await res.text();
        const scraperEntry = getScraperByName(entry.shop);
        const ScraperClass = scraperEntry?.ScraperClass;
        if (ScraperClass) {
          const scraper = new ScraperClass(() => {}, 'discovery');
          if (typeof scraper.parseOffersFromHtml === 'function') {
            const parsedOffers = scraper.parseOffersFromHtml(html, entry.shop_product_url);
            if (Array.isArray(parsedOffers) && parsedOffers.length > 0) {
              for (const offer of parsedOffers) {
                if (offer.price && offer.price > 0 && offer.seeds && offer.seeds > 0) {
                  const existingOffer = sqlite.prepare(
                    'SELECT id FROM scraped_offers WHERE strain_id = ? AND shop = ? AND seeds = ?'
                  ).get(strainId, entry.shop, offer.seeds);

                  if (!existingOffer) {
                    const offerId = crypto.randomUUID();
                    sqlite.prepare(`
                      INSERT INTO scraped_offers (
                        id, strain_id, shop, url, seeds, price, currency, availability, fetched_at
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                      offerId,
                      strainId,
                      entry.shop,
                      entry.shop_product_url,
                      offer.seeds,
                      offer.price,
                      entry.currency || 'EUR',
                      offer.availability || 'available',
                      now
                    );
                    offersAdded++;
                  }

                  sqlite.prepare(`
                    INSERT INTO price_history (id, strain_id, shop, seeds, price, fetched_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                  `).run(crypto.randomUUID(), strainId, entry.shop, offer.seeds, offer.price, now);
                }
              }
            }
          }
        }
      }
    } catch (fetchErr) {
      // HTML fetch failed or timed out
    }
  }

  // 3. Final Verification: Must have at least 1 offer in scraped_offers now!
  const finalOfferCount = sqlite.prepare(
    'SELECT COUNT(*) AS count FROM scraped_offers WHERE strain_id = ? AND shop = ?'
  ).get(strainId, entry.shop).count;

  if (finalOfferCount === 0) {
    throw new Error(
      `KEIN PREIS: Für '${entry.extracted_name}' (${entry.shop}) konnte KEIN Preis-Angebot geschrieben werden! (Preis in Staging: ${entry.price || 0} €). Der Eintrag darf nicht ohne Preis-Angebot freigegeben werden.`
    );
  }

  return finalOfferCount;
}

export default async function discoveryRoutes(app) {
  
  // Trigger scraper in discovery mode
  app.post('/api/scraper/discovery', async (req, reply) => {
    try {
      const { shop } = req.body || {};
      // Run background scrape in discovery mode
      triggerScrape(shop || null, 'discovery');
      return { success: true, message: `Started discovery scrape for ${shop || 'all shops'}.` };
    } catch (err) {
      reply.status(500).send({ error: err.message });
    }
  });

  // Get staging statistics
  app.get('/api/new-entries/stats', async (req, reply) => {
    try {
      const pendingCount = sqlite.prepare("SELECT COUNT(*) AS count FROM new_scraped_entries WHERE status = 'pending'").get().count;
      const approvedCount = sqlite.prepare("SELECT COUNT(*) AS count FROM new_scraped_entries WHERE status = 'approved'").get().count;
      const rejectedCount = sqlite.prepare("SELECT COUNT(*) AS count FROM new_scraped_entries WHERE status = 'rejected'").get().count;
      const mergedCount = sqlite.prepare("SELECT COUNT(*) AS count FROM new_scraped_entries WHERE status = 'merged'").get().count;

      const shopStats = sqlite.prepare(`
        SELECT shop, status, COUNT(*) AS count
        FROM new_scraped_entries
        GROUP BY shop, status
      `).all();

      return {
        pendingCount,
        approvedCount,
        rejectedCount,
        mergedCount,
        shopStats,
        allShops: getAllShopNames()
      };
    } catch (err) {
      reply.status(500).send({ error: err.message });
    }
  });

  // Get list of discovered new entries with filtering
  app.get('/api/new-entries', async (req, reply) => {
    try {
      const { status = 'pending', shop, search } = req.query || {};

      let sqlQuery = `
        SELECT e.*, s.name AS suggestedStrainName, s.breeder AS suggestedStrainBreeder
        FROM new_scraped_entries e
        LEFT JOIN strains s ON e.suggested_strain_id = s.id
        WHERE 1=1
      `;
      const params = [];

      if (status && status !== 'all') {
        sqlQuery += ` AND e.status = ?`;
        params.push(status);
      }

      if (shop) {
        sqlQuery += ` AND e.shop = ?`;
        params.push(shop);
      }

      if (search) {
        sqlQuery += ` AND (e.extracted_name LIKE ? OR e.extracted_breeder LIKE ? OR e.raw_title LIKE ?)`;
        const term = `%${search.trim()}%`;
        params.push(term, term, term);
      }

      sqlQuery += ` ORDER BY e.created_at DESC LIMIT 300`;

      const rows = sqlite.prepare(sqlQuery).all(...params);

      // Convert snake_case db columns to camelCase for frontend consistency
      const formatted = rows.map(r => ({
        id: r.id,
        shop: r.shop,
        shopProductUrl: r.shop_product_url,
        rawTitle: r.raw_title,
        extractedName: r.extracted_name,
        extractedBreeder: r.extracted_breeder,
        seeds: r.seeds,
        price: r.price,
        currency: r.currency,
        type: r.type,
        seedType: r.seed_type,
        thc: r.thc,
        cbd: r.cbd,
        strainType: r.strain_type,
        floweringTime: r.flowering_time,
        description: r.description,
        genetics: r.genetics,
        suggestedStrainId: r.suggested_strain_id,
        suggestedStrainName: r.suggestedStrainName,
        suggestedStrainBreeder: r.suggestedStrainBreeder,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));

      return formatted;
    } catch (err) {
      reply.status(500).send({ error: err.message });
    }
  });

  // Update a staged entry's fields (e.g. type, seedType)
  app.put('/api/new-entries/:id', async (req, reply) => {
    try {
      const { id } = req.params;
      const { type, seedType, extractedName, extractedBreeder } = req.body || {};
      
      const entry = sqlite.prepare('SELECT * FROM new_scraped_entries WHERE id = ?').get(id);
      if (!entry) {
        return reply.status(404).send({ error: 'Staged entry not found.' });
      }

      const now = new Date().toISOString();
      sqlite.prepare(`
        UPDATE new_scraped_entries
        SET type = ?,
            seed_type = ?,
            extracted_name = ?,
            extracted_breeder = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        type !== undefined ? type : entry.type,
        seedType !== undefined ? seedType : entry.seed_type,
        extractedName !== undefined ? extractedName : entry.extracted_name,
        extractedBreeder !== undefined ? extractedBreeder : entry.extracted_breeder,
        now,
        id
      );

      // Re-link suggested_strain_id if name changed
      if (extractedName !== undefined && extractedName !== entry.extracted_name) {
        const match = sqlite.prepare('SELECT id FROM strains WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1').get(extractedName);
        sqlite.prepare('UPDATE new_scraped_entries SET suggested_strain_id = ? WHERE id = ?').run(match ? match.id : null, id);
      }

      return { success: true, message: 'Staged entry updated successfully.' };
    } catch (err) {
      reply.status(500).send({ error: err.message });
    }
  });

  // Approve staged entries (Imports into strains & scraped_offers)
  app.post('/api/new-entries/approve', async (req, reply) => {
    try {
      const { ids } = req.body || {};
      const targetIds = Array.isArray(ids) ? ids : (req.body.id ? [req.body.id] : []);

      if (targetIds.length === 0) {
        return reply.status(400).send({ error: 'No entry IDs provided for approval.' });
      }

      let approvedCount = 0;
      const errors = [];
      const now = new Date().toISOString();

      for (const entryId of targetIds) {
        const entry = sqlite.prepare('SELECT * FROM new_scraped_entries WHERE id = ?').get(entryId);
        if (!entry) continue;

        try {
          // 1. Check if strain already exists in strains table
          let strain = sqlite.prepare(`
            SELECT * FROM strains 
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) 
              AND LOWER(TRIM(COALESCE(breeder, ''))) = LOWER(TRIM(COALESCE(?, '')))
          `).get(entry.extracted_name, entry.extracted_breeder || '');

          let strainId;

          if (strain) {
            strainId = strain.id;
          } else {
            // Create new strain in strains table
            strainId = crypto.randomUUID();
            sqlite.prepare(`
              INSERT INTO strains (
                id, name, breeder, type, seed_type, thc, cbd, strain_type, 
                flowering_time, genetics, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              strainId,
              entry.extracted_name,
              entry.extracted_breeder || 'Unknown Breeder',
              entry.type,
              entry.seed_type,
              entry.thc,
              entry.cbd,
              entry.strain_type,
              entry.flowering_time,
              entry.genetics,
              now,
              now
            );
          }

          // 2. Ensure offers are parsed and written to scraped_offers
          await processOffersForStagedEntry(entry, strainId, now);

          // 3. Add shop description if available
          if (entry.description && entry.description.trim()) {
            const existingDesc = sqlite.prepare('SELECT 1 FROM strain_shop_descriptions WHERE strain_id = ? AND shop = ?')
              .get(strainId, entry.shop);
            if (!existingDesc) {
              sqlite.prepare(`
                INSERT INTO strain_shop_descriptions (strain_id, shop, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
              `).run(strainId, entry.shop, entry.description.trim(), now, now);
            }
          }

          // 4. Update status in staging
          sqlite.prepare("UPDATE new_scraped_entries SET status = 'approved', updated_at = ? WHERE id = ?").run(now, entryId);
          approvedCount++;
        } catch (itemErr) {
          errors.push(itemErr.message);
        }
      }

      if (errors.length > 0 && approvedCount === 0) {
        return reply.status(400).send({
          success: false,
          error: `FEHLER BEIM IMPORT: ${errors.join(' | ')}`,
          errors
        });
      }

      return {
        success: true,
        count: approvedCount,
        message: `Approved and imported ${approvedCount} entries into main database.`,
        warnings: errors.length > 0 ? errors : undefined
      };
    } catch (err) {
      reply.status(500).send({ error: err.message });
    }
  });

  // Merge staged entry into an existing strain
  app.post('/api/new-entries/merge', async (req, reply) => {
    try {
      const { id, targetStrainId } = req.body || {};
      if (!id || !targetStrainId) {
        return reply.status(400).send({ error: 'Missing entry id or targetStrainId' });
      }

      const entry = sqlite.prepare('SELECT * FROM new_scraped_entries WHERE id = ?').get(id);
      if (!entry) {
        return reply.status(404).send({ error: 'Staged entry not found.' });
      }

      const targetStrain = sqlite.prepare('SELECT * FROM strains WHERE id = ?').get(targetStrainId);
      if (!targetStrain) {
        return reply.status(404).send({ error: 'Target strain not found in database.' });
      }

      const now = new Date().toISOString();

      // Ensure offers are written to scraped_offers under targetStrainId
      await processOffersForStagedEntry(entry, targetStrainId, now);

      // Add shop description if available
      if (entry.description && entry.description.trim()) {
        const existingDesc = sqlite.prepare('SELECT 1 FROM strain_shop_descriptions WHERE strain_id = ? AND shop = ?')
          .get(targetStrainId, entry.shop);
        if (!existingDesc) {
          sqlite.prepare(`
            INSERT INTO strain_shop_descriptions (strain_id, shop, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(targetStrainId, entry.shop, entry.description.trim(), now, now);
        }
      }

      // Mark as merged
      sqlite.prepare("UPDATE new_scraped_entries SET status = 'merged', suggested_strain_id = ?, updated_at = ? WHERE id = ?")
        .run(targetStrainId, now, id);

      return { success: true, message: `Successfully merged offer into strain "${targetStrain.name}".` };
    } catch (err) {
      reply.status(400).send({
        success: false,
        error: `FEHLER BEIM MERGEN: ${err.message}`
      });
    }
  });

  // Reject staged entries
  app.post('/api/new-entries/reject', async (req, reply) => {
    try {
      const { ids } = req.body || {};
      const targetIds = Array.isArray(ids) ? ids : (req.body.id ? [req.body.id] : []);

      if (targetIds.length === 0) {
        return reply.status(400).send({ error: 'No entry IDs provided for rejection.' });
      }

      const now = new Date().toISOString();
      let rejectedCount = 0;

      sqlite.transaction(() => {
        const stmt = sqlite.prepare("UPDATE new_scraped_entries SET status = 'rejected', updated_at = ? WHERE id = ?");
        for (const id of targetIds) {
          stmt.run(now, id);
          rejectedCount++;
        }
      })();

      return { success: true, count: rejectedCount, message: `Rejected ${rejectedCount} entries.` };
    } catch (err) {
      reply.status(500).send({ error: err.message });
    }
  });

  // Clear resolved or rejected entries from staging
  app.post('/api/new-entries/clear', async (req, reply) => {
    try {
      const { status = 'rejected', clearAll = false } = req.body || {};

      let result;
      if (clearAll) {
        result = sqlite.prepare("DELETE FROM new_scraped_entries WHERE status IN ('approved', 'rejected', 'merged')").run();
      } else {
        result = sqlite.prepare("DELETE FROM new_scraped_entries WHERE status = ?").run(status);
      }

      return { success: true, deletedCount: result.changes, message: `Cleared ${result.changes} entries from staging.` };
    } catch (err) {
      reply.status(500).send({ error: err.message });
    }
  });

}
