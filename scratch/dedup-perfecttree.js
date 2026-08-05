import { sqlite } from '../server/src/db.js';

const dups = sqlite.prepare(`
  SELECT LOWER(name) as norm_name, LOWER(breeder) as norm_breeder, GROUP_CONCAT(id) as strain_ids, COUNT(*) as count
  FROM strains
  GROUP BY LOWER(name), LOWER(breeder)
  HAVING count > 1
`).all();

console.log('Duplicate strain groups to merge:', dups);

for (const group of dups) {
  const ids = group.strain_ids.split(',');
  const keepId = ids[0];
  const removeIds = ids.slice(1);

  for (const removeId of removeIds) {
    console.log(`Merging ${removeId} into ${keepId} (${group.norm_name} - ${group.norm_breeder})...`);

    sqlite.prepare(`UPDATE OR IGNORE scraped_offers SET strain_id = ? WHERE strain_id = ?`).run(keepId, removeId);
    sqlite.prepare(`DELETE FROM scraped_offers WHERE strain_id = ?`).run(removeId);

    sqlite.prepare(`UPDATE OR IGNORE price_history SET strain_id = ? WHERE strain_id = ?`).run(keepId, removeId);
    sqlite.prepare(`DELETE FROM price_history WHERE strain_id = ?`).run(removeId);

    sqlite.prepare(`UPDATE OR IGNORE strain_shop_descriptions SET strain_id = ? WHERE strain_id = ?`).run(keepId, removeId);
    sqlite.prepare(`DELETE FROM strain_shop_descriptions WHERE strain_id = ?`).run(removeId);

    sqlite.prepare(`DELETE FROM strains WHERE id = ?`).run(removeId);
  }
}

console.log('Deduplication finished!');
