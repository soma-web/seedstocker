/**
 * Database schema initialization and migrations.
 * Replaces the 120+ lines of manual DDL and try/catch ALTER TABLE blocks
 * that were previously in index.js.
 *
 * Uses a simple version tracking table so each migration runs exactly once.
 */

export function initializeDatabase(sqlite) {
  // Create the migration tracking table first
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    sqlite.prepare('SELECT name FROM _migrations').all().map(r => r.name)
  );

  function runMigration(name, sql) {
    if (applied.has(name)) return;
    sqlite.exec(sql);
    sqlite.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(name, new Date().toISOString());
  }

  // ── V001: Core tables ────────────────────────────────────────────────────
  runMigration('001_core_tables', `
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
  `);

  // ── V002: Core indexes ───────────────────────────────────────────────────
  runMigration('002_core_indexes', `
    CREATE INDEX IF NOT EXISTS idx_strains_name_breeder ON strains(name, breeder);
    CREATE INDEX IF NOT EXISTS idx_scraped_offers_strain ON scraped_offers(strain_id);
    CREATE INDEX IF NOT EXISTS idx_price_history_strain ON price_history(strain_id);
    CREATE INDEX IF NOT EXISTS idx_strain_shop_descriptions_strain ON strain_shop_descriptions(strain_id);
  `);

  // ── V003: Additional performance indexes (issue #14) ─────────────────────
  runMigration('003_performance_indexes', `
    CREATE INDEX IF NOT EXISTS idx_scraped_offers_shop ON scraped_offers(shop);
    CREATE INDEX IF NOT EXISTS idx_price_history_lookup ON price_history(strain_id, shop, seeds, fetched_at);
    CREATE INDEX IF NOT EXISTS idx_scraped_offers_upsert ON scraped_offers(strain_id, shop, seeds);
  `);

  // ── V004: Data cleanup (issues #6, #9, #16) ─────────────────────────────
  runMigration('004_data_cleanup', (() => {
    // Delete offers with price <= 0
    sqlite.prepare('DELETE FROM scraped_offers WHERE price <= 0').run();

    // Delete matching price_history entries
    sqlite.prepare('DELETE FROM price_history WHERE id IN (SELECT ph.id FROM price_history ph INNER JOIN scraped_offers o ON ph.strain_id = o.strain_id AND ph.shop = o.shop AND ph.seeds = o.seeds WHERE o.price <= 0)').run();

    // Fix strain names containing leftover keywords
    const keywords = ['Feminisiert', 'Feminisierte', 'Feminized', 'Autoflowering', 'Regular', 'Regulär'];
    for (const kw of keywords) {
      sqlite.prepare(`UPDATE strains SET name = TRIM(REPLACE(name, ?, '')), updated_at = ? WHERE name LIKE ?`)
        .run(kw, new Date().toISOString(), `%${kw}%`);
    }

    // Merge true duplicate strains (same name + breeder, case-insensitive)
    // Keep the oldest one (earliest created_at), reassign all offers/descriptions to it
    const dupes = sqlite.prepare(`
      SELECT GROUP_CONCAT(id) as ids, LOWER(TRIM(name)) as lname, LOWER(TRIM(breeder)) as lbreeder
      FROM strains
      GROUP BY LOWER(TRIM(name)), LOWER(TRIM(breeder))
      HAVING COUNT(*) > 1
    `).all();

    for (const dup of dupes) {
      const ids = dup.ids.split(',');
      // Find the keeper (earliest created_at)
      const sorted = sqlite.prepare(
        `SELECT id FROM strains WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at ASC`
      ).all(...ids);

      const keepId = sorted[0].id;
      const removeIds = sorted.slice(1).map(r => r.id);

      for (const removeId of removeIds) {
        // Reassign offers
        sqlite.prepare('UPDATE scraped_offers SET strain_id = ? WHERE strain_id = ?').run(keepId, removeId);
        // Reassign price history
        sqlite.prepare('UPDATE price_history SET strain_id = ? WHERE strain_id = ?').run(keepId, removeId);
        // Merge descriptions (skip if already exists for keeper+shop)
        const descs = sqlite.prepare('SELECT * FROM strain_shop_descriptions WHERE strain_id = ?').all(removeId);
        for (const desc of descs) {
          const existing = sqlite.prepare('SELECT 1 FROM strain_shop_descriptions WHERE strain_id = ? AND shop = ?').get(keepId, desc.shop);
          if (!existing) {
            sqlite.prepare('UPDATE strain_shop_descriptions SET strain_id = ? WHERE strain_id = ? AND shop = ?').run(keepId, removeId, desc.shop);
          } else {
            sqlite.prepare('DELETE FROM strain_shop_descriptions WHERE strain_id = ? AND shop = ?').run(removeId, desc.shop);
          }
        }
        // Move AI/rewritten descriptions if keeper doesn't have one
        const aiDesc = sqlite.prepare('SELECT 1 FROM ai_descriptions WHERE strain_id = ?').get(keepId);
        if (!aiDesc) {
          sqlite.prepare('UPDATE ai_descriptions SET strain_id = ? WHERE strain_id = ?').run(keepId, removeId);
        } else {
          sqlite.prepare('DELETE FROM ai_descriptions WHERE strain_id = ?').run(removeId);
        }
        const rwDesc = sqlite.prepare('SELECT 1 FROM rewritten_descriptions WHERE strain_id = ?').get(keepId);
        if (!rwDesc) {
          sqlite.prepare('UPDATE rewritten_descriptions SET strain_id = ? WHERE strain_id = ?').run(keepId, removeId);
        } else {
          sqlite.prepare('DELETE FROM rewritten_descriptions WHERE strain_id = ?').run(removeId);
        }
        // Delete the duplicate strain
        sqlite.prepare('DELETE FROM strains WHERE id = ?').run(removeId);
      }
    }

    // Return empty SQL since we ran everything via prepared statements
    return 'SELECT 1';
  })());

  // ── V005: New Scraped Entries Staging Table ─────────────────────────────
  runMigration('005_new_scraped_entries_table', `
    CREATE TABLE IF NOT EXISTS new_scraped_entries (
      id TEXT PRIMARY KEY,
      shop TEXT NOT NULL,
      shop_product_url TEXT NOT NULL,
      raw_title TEXT NOT NULL,
      extracted_name TEXT NOT NULL,
      extracted_breeder TEXT,
      seeds INTEGER NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      type TEXT,
      seed_type TEXT,
      thc TEXT,
      cbd TEXT,
      strain_type TEXT,
      flowering_time TEXT,
      description TEXT,
      genetics TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_new_scraped_entries_shop_status ON new_scraped_entries(shop, status);
    CREATE INDEX IF NOT EXISTS idx_new_scraped_entries_name_breeder ON new_scraped_entries(extracted_name, extracted_breeder);
  `);

  // ── V006: Auto-populate URLs for existing staged entries ─────────────────
  runMigration('006_fix_new_scraped_entries_urls', (() => {
    const shopifyUrls = {
      'Gas Station LU': 'https://gas-station.lu/products/',
      'Gas Station Co. Seeds': 'https://gasstationcoseeds.de/products/',
      'House of Seeds': 'https://house-of-seeds.de/products/',
      'Hans Brainfood': 'https://hansbrainfood.de/products/'
    };

    for (const [shopName, prefix] of Object.entries(shopifyUrls)) {
      const rows = sqlite.prepare("SELECT id, raw_title FROM new_scraped_entries WHERE shop = ? AND (shop_product_url = '' OR shop_product_url IS NULL)").all(shopName);
      for (const r of rows) {
        const handle = (r.raw_title || '')
          .toLowerCase()
          .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        if (handle) {
          const generatedUrl = `${prefix}${handle}`;
          sqlite.prepare("UPDATE new_scraped_entries SET shop_product_url = ? WHERE id = ?").run(generatedUrl, r.id);
        }
      }
    }

    // Sensi Seeds fallback URL
    const sensiRows = sqlite.prepare("SELECT id, extracted_name FROM new_scraped_entries WHERE shop = 'Sensi Seeds' AND (shop_product_url = '' OR shop_product_url IS NULL)").all();
    for (const r of sensiRows) {
      const slug = (r.extracted_name || '')
        .toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const sensiUrl = `https://sensiseeds.com/de/hanfsamen/sensi-seeds/${slug}`;
      sqlite.prepare("UPDATE new_scraped_entries SET shop_product_url = ? WHERE id = ?").run(sensiUrl, r.id);
    }

    return 'SELECT 1';
  })());

  // ── V007: Normalize smart apostrophes & auto-link suggested strains ───────
  runMigration('007_normalize_apostrophes_and_link_staging', (() => {
    // 1. Normalize strains table
    sqlite.prepare("UPDATE strains SET name = REPLACE(REPLACE(REPLACE(name, '’', ''''), '‘', ''''), '`', ''''), breeder = REPLACE(REPLACE(REPLACE(breeder, '’', ''''), '‘', ''''), '`', '''')").run();

    // 2. Normalize new_scraped_entries table
    sqlite.prepare("UPDATE new_scraped_entries SET raw_title = REPLACE(REPLACE(REPLACE(raw_title, '’', ''''), '‘', ''''), '`', ''''), extracted_name = REPLACE(REPLACE(REPLACE(extracted_name, '’', ''''), '‘', ''''), '`', ''''), extracted_breeder = REPLACE(REPLACE(REPLACE(extracted_breeder, '’', ''''), '‘', ''''), '`', '''')").run();

    // 3. Link suggested_strain_id for all pending staged entries
    sqlite.prepare(`
      UPDATE new_scraped_entries
      SET suggested_strain_id = (
        SELECT s.id FROM strains s 
        WHERE LOWER(TRIM(s.name)) = LOWER(TRIM(new_scraped_entries.extracted_name))
        LIMIT 1
      )
      WHERE status = 'pending'
    `).run();

    return 'SELECT 1';
  })());

  // ── V008: Strip leading BF prefix from strain names ────────────────────────
  runMigration('008_strip_bf_prefix_from_strains', (() => {
    const now = new Date().toISOString();
    const bfStrains = sqlite.prepare("SELECT * FROM strains WHERE name LIKE 'BF %' OR name LIKE 'BF-%'").all();

    for (const strain of bfStrains) {
      const cleanName = strain.name.replace(/^BF[\s\-]+/i, '').trim();

      // Check if strain with cleanName already exists
      const existing = sqlite.prepare("SELECT * FROM strains WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND LOWER(TRIM(COALESCE(breeder, ''))) = LOWER(TRIM(COALESCE(?, ''))) AND id != ?")
        .get(cleanName, strain.breeder || '', strain.id);

      if (existing) {
        // Reassign offers & price history to existing strain
        sqlite.prepare('UPDATE scraped_offers SET strain_id = ? WHERE strain_id = ?').run(existing.id, strain.id);
        sqlite.prepare('UPDATE price_history SET strain_id = ? WHERE strain_id = ?').run(existing.id, strain.id);
        sqlite.prepare('DELETE FROM strains WHERE id = ?').run(strain.id);
      } else {
        // Simple rename
        sqlite.prepare('UPDATE strains SET name = ?, updated_at = ? WHERE id = ?').run(cleanName, now, strain.id);
      }
    }

    // Also clean up new_scraped_entries table
    const stagedBf = sqlite.prepare("SELECT id, extracted_name FROM new_scraped_entries WHERE extracted_name LIKE 'BF %' OR extracted_name LIKE 'BF-%'").all();
    for (const entry of stagedBf) {
      const cleanName = entry.extracted_name.replace(/^BF[\s\-]+/i, '').trim();
      sqlite.prepare('UPDATE new_scraped_entries SET extracted_name = ?, updated_at = ? WHERE id = ?').run(cleanName, now, entry.id);
    }

    return 'SELECT 1';
  })());

  // ── V009: Strip leading TB prefix from strain names ────────────────────────
  runMigration('009_strip_tb_prefix_from_strains', (() => {
    const now = new Date().toISOString();
    const tbStrains = sqlite.prepare("SELECT * FROM strains WHERE name LIKE 'TB %' OR name LIKE 'TB-%'").all();

    for (const strain of tbStrains) {
      const cleanName = strain.name.replace(/^TB[\s\-]+/i, '').trim();

      // Check if strain with cleanName already exists
      const existing = sqlite.prepare("SELECT * FROM strains WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND LOWER(TRIM(COALESCE(breeder, ''))) = LOWER(TRIM(COALESCE(?, ''))) AND id != ?")
        .get(cleanName, strain.breeder || '', strain.id);

      if (existing) {
        // Reassign offers & price history to existing strain
        sqlite.prepare('UPDATE scraped_offers SET strain_id = ? WHERE strain_id = ?').run(existing.id, strain.id);
        sqlite.prepare('UPDATE price_history SET strain_id = ? WHERE strain_id = ?').run(existing.id, strain.id);
        sqlite.prepare('DELETE FROM strains WHERE id = ?').run(strain.id);
      } else {
        // Simple rename
        sqlite.prepare('UPDATE strains SET name = ?, updated_at = ? WHERE id = ?').run(cleanName, now, strain.id);
      }
    }

    // Also clean up new_scraped_entries table
    const stagedTb = sqlite.prepare("SELECT id, extracted_name FROM new_scraped_entries WHERE extracted_name LIKE 'TB %' OR extracted_name LIKE 'TB-%'").all();
    for (const entry of stagedTb) {
      const cleanName = entry.extracted_name.replace(/^TB[\s\-]+/i, '').trim();
      sqlite.prepare('UPDATE new_scraped_entries SET extracted_name = ?, updated_at = ? WHERE id = ?').run(cleanName, now, entry.id);
    }

    // Re-link suggested_strain_id for all pending staged entries
    sqlite.prepare(`
      UPDATE new_scraped_entries
      SET suggested_strain_id = (
        SELECT s.id FROM strains s 
        WHERE LOWER(TRIM(s.name)) = LOWER(TRIM(new_scraped_entries.extracted_name))
        LIMIT 1
      )
      WHERE status = 'pending'
    `).run();

    return 'SELECT 1';
  })());
}

