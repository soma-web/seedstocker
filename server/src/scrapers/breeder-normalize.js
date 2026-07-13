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
]);

// All known aliases (lowercase) for matching
const KNOWN_BREEDERS = new Set(BREEDER_ALIASES.keys());

// Noise words to strip from breeder names (German product descriptors)
const NOISE_RE = /[\s,]*(feminisierte?n?|feminized|regular|regulär|cannabissamen|cannabis\s*seeds|cannabis|premium|limited\s*(edition|drop)|drop|exclusive|samen)\s*/gi;

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

export { BREEDER_ALIASES, KNOWN_BREEDERS };
