import { sqlite } from '../server/src/db.js';

const updateNonameStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = 'Noname Bulk Seeds'
  WHERE LOWER(breeder) IN ('hanfsamen großpackungen', 'hanfsamen großpackung', 'hanf großpackungen', 'hanf großpackung', 'großpackungen', 'großpackung', 'grosspackungen', 'grosspackung')
`).run();

const updateNonameEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = 'Noname Bulk Seeds'
  WHERE LOWER(extracted_breeder) IN ('hanfsamen großpackungen', 'hanfsamen großpackung', 'hanf großpackungen', 'hanf großpackung', 'großpackungen', 'großpackung', 'grosspackungen', 'grosspackung')
`).run();

console.log('Noname Bulk Seeds strains updated:', updateNonameStrains.changes);
console.log('Noname Bulk Seeds entries updated:', updateNonameEntries.changes);

const updateBulkStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = 'Bulk Seed Bank'
  WHERE LOWER(breeder) IN ('bulkseedbank', 'bulk seed bank')
`).run();

const updateBulkEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = 'Bulk Seed Bank'
  WHERE LOWER(extracted_breeder) IN ('bulkseedbank', 'bulk seed bank')
`).run();

console.log('Bulk Seed Bank strains updated:', updateBulkStrains.changes);
console.log('Bulk Seed Bank entries updated:', updateBulkEntries.changes);

const updateSeedstockersStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = 'Seedstockers'
  WHERE LOWER(breeder) IN ('seed stockers', 'seedstockers')
`).run();

const updateSeedstockersEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = 'Seedstockers'
  WHERE LOWER(extracted_breeder) IN ('seed stockers', 'seedstockers')
`).run();

console.log('Seedstockers strains updated:', updateSeedstockersStrains.changes);
console.log('Seedstockers entries updated:', updateSeedstockersEntries.changes);
