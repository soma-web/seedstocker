import { sqlite } from '../server/src/db.js';

const updateStrains = sqlite.prepare(`
  UPDATE strains
  SET breeder = 'GrowersChoice'
  WHERE LOWER(breeder) IN ('growers choice', 'growerschoice', 'growers choice seeds', 'growerschoice seeds', 'grower choice', 'growerchoice')
`).run();

console.log('Updated strains:', updateStrains.changes);

const updateEntries = sqlite.prepare(`
  UPDATE new_scraped_entries
  SET extracted_breeder = 'GrowersChoice'
  WHERE LOWER(extracted_breeder) IN ('growers choice', 'growerschoice', 'growers choice seeds', 'growerschoice seeds', 'grower choice', 'growerchoice')
`).run();

console.log('Updated new_scraped_entries:', updateEntries.changes);
