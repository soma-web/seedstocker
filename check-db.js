import { db } from './server/src/db.js';
import { strains, newScrapedEntries } from './server/src/schema.js';
import { eq, sql } from 'drizzle-orm';

async function check() {
  const matchingStrains = await db.select()
    .from(strains)
    .where(sql`LOWER(name) = 'amnesia haze' OR LOWER(name) = 'gorilla cookies' OR LOWER(name) = 'gorilla glue #4'`)
    .limit(10);
  
  console.log('--- MATCHING EXISTING STRAINS IN MAIN DB ---');
  for (const s of matchingStrains) {
    console.log(`ID: ${s.id} | Name: "${s.name}" | Breeder: "${s.breeder}" | SeedType: "${s.seedType}"`);
  }

  const staged = await db.select()
    .from(newScrapedEntries)
    .where(eq(newScrapedEntries.shop, 'Linda Seeds'));

  console.log('\n--- STAGED ENTRIES FOR LINDA SEEDS ---');
  for (const entry of staged) {
    console.log(`ID: ${entry.id} | Name: "${entry.extractedName}" | Breeder: "${entry.extractedBreeder}" | SuggestedStrainId: "${entry.suggestedStrainId}"`);
  }
}

check().catch(console.error);
