import Database from 'better-sqlite3';

const dbPath = './data/seedstocker.db';
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

try {
  // Run all operations in a transaction
  db.transaction(() => {
    // 1. Get all strains where breeder = 'Research'
    const researchStrains = db.prepare(`
      SELECT id, name FROM strains WHERE breeder = 'Research'
    `).all();

    console.log(`Found ${researchStrains.length} strains with breeder = 'Research'. Starting migration...`);

    for (const strain of researchStrains) {
      const researchId = strain.id;
      const name = strain.name.trim();

      // Check if there is an existing strain with the same name and breeder = 'Sensi Seeds'
      const sensiStrain = db.prepare(`
        SELECT id FROM strains 
        WHERE LOWER(TRIM(name)) = LOWER(?) AND breeder = 'Sensi Seeds'
        LIMIT 1
      `).get(name);

      if (sensiStrain) {
        const sensiId = sensiStrain.id;
        console.log(`Merging duplicate strain "${name}":`);
        console.log(`  - Research ID: ${researchId}`);
        console.log(`  - Sensi Seeds ID: ${sensiId}`);

        // --- MERGE scraped_offers ---
        const researchOffers = db.prepare(`
          SELECT id, shop, seeds FROM scraped_offers WHERE strain_id = ?
        `).all(researchId);

        for (const offer of researchOffers) {
          const duplicateOffer = db.prepare(`
            SELECT id FROM scraped_offers 
            WHERE strain_id = ? AND shop = ? AND seeds = ?
            LIMIT 1
          `).get(sensiId, offer.shop, offer.seeds);

          if (duplicateOffer) {
            // Sensi Seeds strain already has this offer, delete the duplicate from Research strain
            db.prepare(`DELETE FROM scraped_offers WHERE id = ?`).run(offer.id);
            console.log(`  - Deleted duplicate offer ID: ${offer.id} (${offer.shop}, ${offer.seeds} seeds)`);
          } else {
            // No duplicate offer, update strain_id to sensiId
            db.prepare(`UPDATE scraped_offers SET strain_id = ? WHERE id = ?`).run(sensiId, offer.id);
            console.log(`  - Updated offer ID: ${offer.id} to Sensi Seeds strain`);
          }
        }

        // --- MERGE price_history ---
        // Since price_history has no unique constraints, simply update all records to sensiId
        const historyUpdate = db.prepare(`
          UPDATE price_history SET strain_id = ? WHERE strain_id = ?
        `).run(sensiId, researchId);
        console.log(`  - Updated ${historyUpdate.changes} price history records`);

        // --- MERGE strain_shop_descriptions ---
        const researchDescriptions = db.prepare(`
          SELECT shop FROM strain_shop_descriptions WHERE strain_id = ?
        `).all(researchId);

        for (const desc of researchDescriptions) {
          const duplicateDesc = db.prepare(`
            SELECT 1 FROM strain_shop_descriptions 
            WHERE strain_id = ? AND shop = ?
            LIMIT 1
          `).get(sensiId, desc.shop);

          if (duplicateDesc) {
            // Delete duplicate description
            db.prepare(`
              DELETE FROM strain_shop_descriptions WHERE strain_id = ? AND shop = ?
            `).run(researchId, desc.shop);
            console.log(`  - Deleted duplicate description for shop: ${desc.shop}`);
          } else {
            // Update description strain_id
            db.prepare(`
              UPDATE strain_shop_descriptions SET strain_id = ? WHERE strain_id = ? AND shop = ?
            `).run(sensiId, researchId, desc.shop);
            console.log(`  - Updated description for shop: ${desc.shop} to Sensi Seeds strain`);
          }
        }

        // --- MERGE rewritten_descriptions ---
        const rewrittenForResearch = db.prepare(`
          SELECT 1 FROM rewritten_descriptions WHERE strain_id = ?
        `).get(researchId);

        if (rewrittenForResearch) {
          const rewrittenForSensi = db.prepare(`
            SELECT 1 FROM rewritten_descriptions WHERE strain_id = ?
          `).get(sensiId);

          if (rewrittenForSensi) {
            db.prepare(`DELETE FROM rewritten_descriptions WHERE strain_id = ?`).run(researchId);
            console.log(`  - Deleted duplicate rewritten description`);
          } else {
            db.prepare(`
              UPDATE rewritten_descriptions SET strain_id = ? WHERE strain_id = ?
            `).run(sensiId, researchId);
            console.log(`  - Updated rewritten description to Sensi Seeds strain`);
          }
        }

        // --- MERGE ai_descriptions ---
        const aiForResearch = db.prepare(`
          SELECT 1 FROM ai_descriptions WHERE strain_id = ?
        `).get(researchId);

        if (aiForResearch) {
          const aiForSensi = db.prepare(`
            SELECT 1 FROM ai_descriptions WHERE strain_id = ?
          `).get(sensiId);

          if (aiForSensi) {
            db.prepare(`DELETE FROM ai_descriptions WHERE strain_id = ?`).run(researchId);
            console.log(`  - Deleted duplicate AI description`);
          } else {
            db.prepare(`
              UPDATE ai_descriptions SET strain_id = ? WHERE strain_id = ?
            `).run(sensiId, researchId);
            console.log(`  - Updated AI description to Sensi Seeds strain`);
          }
        }

        // --- DELETE research strain ---
        db.prepare(`DELETE FROM strains WHERE id = ?`).run(researchId);
        console.log(`  - Deleted Research strain record`);

      } else {
        // No duplicate exists, just update breeder to 'Sensi Seeds'
        db.prepare(`
          UPDATE strains SET breeder = 'Sensi Seeds', updated_at = ? WHERE id = ?
        `).run(new Date().toISOString(), researchId);
        console.log(`Updated breeder to 'Sensi Seeds' for unique strain "${name}" (ID: ${researchId})`);
      }
    }
  })();

  console.log('Database migration completed successfully.');
} catch (err) {
  console.error('Error running migration transaction:', err);
} finally {
  db.close();
}
