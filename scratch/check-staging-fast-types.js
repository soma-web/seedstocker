import { sqlite } from '../server/src/db.js';

const rows = sqlite.prepare(`
  SELECT id, raw_title, shop_product_url, type
  FROM new_scraped_entries
  WHERE type = 'photoperiodic'
    AND (
      LOWER(raw_title) LIKE '%fast flowering%'
      OR LOWER(raw_title) LIKE '%fast-flowering%'
      OR LOWER(raw_title) LIKE '%fast version%'
      OR LOWER(raw_title) LIKE '%fast-version%'
      OR LOWER(raw_title) LIKE '%schnellblühend%'
      OR LOWER(raw_title) LIKE '% ff'
      OR LOWER(raw_title) LIKE '% ff %'
      OR LOWER(shop_product_url) LIKE '%fast-flowering%'
      OR LOWER(shop_product_url) LIKE '%fast-version%'
    )
`).all();

console.log('Misclassified Fast Flowering entries in staging:', rows);

if (rows.length > 0) {
  const updateRes = sqlite.prepare(`
    UPDATE new_scraped_entries
    SET type = 'fast_flowering'
    WHERE type = 'photoperiodic'
      AND (
        LOWER(raw_title) LIKE '%fast flowering%'
        OR LOWER(raw_title) LIKE '%fast-flowering%'
        OR LOWER(raw_title) LIKE '%fast version%'
        OR LOWER(raw_title) LIKE '%fast-version%'
        OR LOWER(raw_title) LIKE '%schnellblühend%'
        OR LOWER(raw_title) LIKE '% ff'
        OR LOWER(raw_title) LIKE '% ff %'
        OR LOWER(shop_product_url) LIKE '%fast-flowering%'
        OR LOWER(shop_product_url) LIKE '%fast-version%'
      )
  `).run();

  console.log('Updated staging entries to fast_flowering:', updateRes.changes);
}
