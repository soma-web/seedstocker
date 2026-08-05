import { sqlite } from '../server/src/db.js';

const rows = sqlite.prepare(`
  SELECT id, name, breeder, created_at
  FROM strains
  WHERE LOWER(name) = 'forbidden runtz' AND LOWER(breeder) = 'growerschoice'
`).all();

console.log('Duplicate strains:', rows);

if (rows.length === 2) {
  const keep = rows[0];
  const remove = rows[1];

  console.log(`Keeping strain ${keep.id}, merging ${remove.id}...`);

  // Move scraped offers from remove -> keep (ignore duplicates)
  sqlite.prepare(`
    UPDATE OR IGNORE scraped_offers
    SET strain_id = ?
    WHERE strain_id = ?
  `).run(keep.id, remove.id);

  // Delete remaining scraped_offers for remove
  sqlite.prepare(`DELETE FROM scraped_offers WHERE strain_id = ?`).run(remove.id);

  // Move price history
  sqlite.prepare(`
    UPDATE OR IGNORE price_history
    SET strain_id = ?
    WHERE strain_id = ?
  `).run(keep.id, remove.id);

  sqlite.prepare(`DELETE FROM price_history WHERE strain_id = ?`).run(remove.id);

  // Move strain_shop_descriptions
  sqlite.prepare(`
    UPDATE OR IGNORE strain_shop_descriptions
    SET strain_id = ?
    WHERE strain_id = ?
  `).run(keep.id, remove.id);

  sqlite.prepare(`DELETE FROM strain_shop_descriptions WHERE strain_id = ?`).run(remove.id);

  // Delete strain record
  sqlite.prepare(`DELETE FROM strains WHERE id = ?`).run(remove.id);

  console.log('Merge complete!');
}
