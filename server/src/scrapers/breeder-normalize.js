// Shared breeder name normalization for all scrapers
// Maps alias (lowercase) → canonical display name

const BREEDER_ALIASES = new Map([
  // Gas Co. own line
  ['gas co. genetics', 'Gas Co. Genetics'],
  ['gas co. genetics ltd.', 'Gas Co. Genetics'],
  ['gas co. genetics ltd', 'Gas Co. Genetics'],
  ['gas co. genetics w.l', 'Gas Co. Genetics'],
  ['gas co', 'Gas Co. Genetics'],
  ['gasco', 'Gas Co. Genetics'],
  ['gasstation', 'Gas Co. Genetics'],

  // US Exklusive
  ['aficionado', 'Aficionado'],
  ['archive seeds', 'Archive Seeds'],
  ['archive', 'Archive Seeds'],
  ['backpackboys', 'Backpackboyz'],
  ['backpack boyz', 'Backpackboyz'],
  ['backpack boy', 'Backpackboyz'],
  ['black tuna', 'Black Tuna'],
  ['bosten roots', 'Bosten Roots'],
  ['bosten root', 'Bosten Roots'],
  ['cannarado', 'Cannarado'],
  ['calix', 'CaliX'],
  ['compound genetics', 'Compound Genetics'],
  ['compound', 'Compound Genetics'],
  ['cookies brand', 'Cookies'],
  ['cookies', 'Cookies'],
  ['cipher genetics', 'Cipher Genetics'],
  ['doja', 'Doja'],
  ['doja exclusive', 'Doja'],
  ['elev8 seeds genetics', 'Elev8 Seeds Genetics'],
  ['elev8 seeds', 'Elev8 Seeds Genetics'],
  ['elev8 genetics', 'Elev8 Seeds Genetics'],
  ['elev8', 'Elev8 Seeds Genetics'],
  ['eleven8 seeds', 'Elev8 Seeds Genetics'],
  ['exotic genetix', 'Exotic Genetix'],
  ['exotic', 'Exotic Genetix'],
  ['fidels', 'Fidels'],
  ['green bodhi', 'Green Bodhi'],
  ['holy smoke seeds', 'Holy Smoke Seeds'],
  ['holy smoke', 'Holy Smoke Seeds'],
  ['inhouse genetics', 'Inhouse Genetics'],
  ['inhouse', 'Inhouse Genetics'],
  ['night owl genetics', 'Night Owl Genetics'],
  ['night owl', 'Night Owl Genetics'],
  ['profilic coast', 'Profilic Coast'],
  ['relentless genetics', 'Relentless Genetics'],
  ['relentless', 'Relentless Genetics'],
  ['robin hood seeds', 'Robin Hood Seeds'],
  ['robin hood', 'Robin Hood Seeds'],
  ['seed junky genetics', 'Seed Junky Genetics'],
  ['sensi', 'Sensi Seeds'],
  ['seed junky', 'Seed Junky Genetics'],
  ['solfire gardens', 'Solfire Gardens'],
  ['solfire', 'Solfire Gardens'],
  ['square one genetics', 'Square One Genetics'],
  ['square one', 'Square One Genetics'],
  ['terphogz genetics', 'Terphogz Genetics'],
  ['terphogz', 'Terphogz Genetics'],
  ['tiki madman', 'Tiki Madman'],
  ['nine weeks harvest', 'Nine Weeks Harvest'],
  ['nine weeks', 'Nine Weeks Harvest'],
  ['wizard tree', 'Wizard Trees'],
  ['wizard trees', 'Wizard Trees'],
  ['capulator', 'Capulator'],
  ['copycat genetix', 'Copycat Genetix'],
  ['copycat', 'Copycat Genetix'],
  ['umami seed company', 'Umami Seed Company'],
  ['umami seeds', 'Umami Seed Company'],
  ['umami', 'Umami Seed Company'],
  ['poppin fire', 'Poppin Fire'],
  ['humboldt seed company', 'Humboldt Seed Company'],
  ['humboldt seeds', 'Humboldt Seed Company'],
  ['humboldt seed co.', 'Humboldt Seed Company'],
  ['nasha genetics', 'Nasha Genetics'],
  ['nasha', 'Nasha Genetics'],

  // EU Exklusive
  ['barneys', "Barney's Farm"],
  ["barney's farm", "Barney's Farm"],
  ['barneys farm', "Barney's Farm"],
  ['concious genetics', 'Concious Genetics'],
  ['concious', 'Concious Genetics'],
  ['conscious genetics', 'Concious Genetics'],
  ['dank genetics', 'Dank Genetics'],
  ['dank', 'Dank Genetics'],
  ['goodlife seeds', 'Goodlife Seeds'],
  ['goodlife', 'Goodlife Seeds'],
  ['grateful seeds', 'Grateful Seeds'],
  ['grateful', 'Grateful Seeds'],
  ['grounded genetics', 'Grounded Genetics'],
  ['gounded genetics', 'Grounded Genetics'],
  ['grounded', 'Grounded Genetics'],
  ['karma genetics', 'Karma Genetics'],
  ['karma', 'Karma Genetics'],
  ['old school genetics', 'Old School Genetics'],
  ['perfect tree', 'Perfect Tree'],
  ['perfect tree seeds', 'Perfect Tree'],
  ['tiki madman', 'Tiki Madman'],
  ['tikimadman', 'Tiki Madman'],
  ['ripper seeds', 'Ripper Seeds'],
  ['ripperseeds', 'Ripper Seeds'],
  ['ripper', 'Ripper Seeds'],

  // Shared BaseScraper & General Breeders
  ['rqs', 'Royal Queen Seeds'],
  ['royal queen', 'Royal Queen Seeds'],
  ['royal queen seeds', 'Royal Queen Seeds'],
  ['dp', 'Dutch Passion'],
  ['dutch passion', 'Dutch Passion'],
  ['dutch passion seeds', 'Dutch Passion'],
  ['ghs', 'Greenhouse Seeds'],
  ['greenhouse', 'Greenhouse Seeds'],
  ['greenhouse seeds', 'Greenhouse Seeds'],
  ['green house', 'Greenhouse Seeds'],
  ['white label', 'White Label (Sensi Seeds)'],
  ['whitelabel', 'White Label (Sensi Seeds)'],
  ['white label seeds', 'White Label (Sensi Seeds)'],
  ['sensi', 'Sensi Seeds'],
  ['sensi seeds', 'Sensi Seeds'],
  ['sensi seed', 'Sensi Seeds'],
  ['sensi x champelli', 'Sensi Seeds x Champelli'],
  ['sensi seeds x champelli', 'Sensi Seeds x Champelli'],
  ['sensi x serge', 'Sensi Seeds x Serge Cannabis'],
  ['sensi seeds x serge', 'Sensi Seeds x Serge Cannabis'],
  ['sensi x serge cannabis', 'Sensi Seeds x Serge Cannabis'],
  ['sensi seeds x serge cannabis', 'Sensi Seeds x Serge Cannabis'],
  ['sweet', 'Sweet Seeds'],
  ['sweet seeds', 'Sweet Seeds'],
  ['sweet seed', 'Sweet Seeds'],
  ['anesia', 'Anesia Seeds'],
  ['anesia seeds', 'Anesia Seeds'],
  ['zamnesia', 'Zamnesia Seeds'],
  ['zamnesia seeds', 'Zamnesia Seeds'],
  ['budvoyage', 'Bud Voyage'],
  ['bud voyage', 'Bud Voyage'],
  ['fastbuds', 'FastBuds'],
  ['fast buds', 'FastBuds'],
  ['2 fast 4 buds', 'FastBuds'],
  ['2fast4buds', 'FastBuds'],
  ['barny', "Barney's Farm"],
  ['barnys', "Barney's Farm"],
  ["barny's farm", "Barney's Farm"],
  ['barnys farm', "Barney's Farm"],
  ['187 sweeds', '187 Sweedz'],
  ['187 sweedz', '187 Sweedz'],
  ['187 strassenbande', '187 Sweedz'],
  ['187', '187 Sweedz'],
]);

// All known aliases (lowercase) for matching
const KNOWN_BREEDERS = new Set(BREEDER_ALIASES.keys());

// Derive canonical-to-aliases mapping dynamically from BREEDER_ALIASES
const CANONICAL_TO_ALIASES = {};
for (const [alias, canonical] of BREEDER_ALIASES.entries()) {
  if (alias.toLowerCase() !== canonical.toLowerCase()) {
    if (!CANONICAL_TO_ALIASES[canonical]) {
      CANONICAL_TO_ALIASES[canonical] = [];
    }
    if (!CANONICAL_TO_ALIASES[canonical].includes(alias)) {
      CANONICAL_TO_ALIASES[canonical].push(alias);
    }
  }
}

// Noise words to strip from breeder names (German product descriptors)
const NOISE_RE = /[\s,]*(feminisierte?n?|feminized|regular|regulär|blitzversand|cannabissamen|cannabis\s*seeds|cannabis|premium|limited\s*(edition|drop)|drop|exclusive|samen)\s*/gi;

/**
 * Normalize a raw breeder string: strip noise words, resolve aliases.
 * Returns the canonical name or the cleaned input if no alias matches.
 */
export function normalizeBreederName(raw) {
  if (!raw) return null;
  let b = raw.trim();
  b = b.replace(NOISE_RE, ' ');
  b = b.replace(/[\s,]+$/, '').trim();
  if (!b) return null;
  const canonical = BREEDER_ALIASES.get(b.toLowerCase());
  return canonical || b;
}

export { BREEDER_ALIASES, KNOWN_BREEDERS, CANONICAL_TO_ALIASES };
