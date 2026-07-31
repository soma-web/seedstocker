import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sqlite } from './db.js';
import { isOfferIgnored } from './test-db-integrity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function generatePriceVarianceReport(outputFileName = 'price_history_variance.txt') {
  const rawHighVariance = sqlite.prepare(`
    SELECT 
      ph.strain_id, 
      s.name AS strain_name, 
      s.breeder, 
      s.type,
      s.seed_type,
      ph.shop, 
      ph.seeds, 
      MIN(ph.price) AS min_price, 
      MAX(ph.price) AS max_price, 
      COUNT(ph.id) AS history_count, 
      ROUND(MAX(ph.price) / MIN(ph.price), 2) AS ratio,
      (SELECT url FROM scraped_offers o WHERE o.strain_id = ph.strain_id AND o.shop = ph.shop AND o.seeds = ph.seeds LIMIT 1) AS offer_url
    FROM price_history ph
    JOIN strains s ON s.id = ph.strain_id
    GROUP BY ph.strain_id, ph.shop, ph.seeds
    HAVING history_count >= 2 AND (MAX(ph.price) / MIN(ph.price)) >= 2.5
    ORDER BY ratio DESC, s.name ASC
  `).all();

  const highVariance = rawHighVariance.filter(o => !isOfferIgnored(o));

  const logDir = path.resolve(__dirname, '../logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const filePath = path.join(logDir, outputFileName);

  const header = `=== SEEDSTOCKER PRICE HISTORY VARIANCE REPORT (Ratio >= 2.5x) ===
Generated At : ${new Date().toISOString()}
Total Fails  : ${highVariance.length}

`;

  const body = highVariance.map((r, idx) => {
    return `[${idx + 1}] Strain ID  : ${r.strain_id}
    Strain Name: ${r.strain_name}
    Breeder    : ${r.breeder || 'Unknown'}
    Type / Seed: ${r.type || 'N/A'} / ${r.seed_type || 'N/A'}
    Shop       : ${r.shop}
    Pack Size  : ${r.seeds} seeds
    Price Range: €${r.min_price} -> €${r.max_price} (Ratio: ${r.ratio}x)
    History Count: ${r.history_count} entries
    Offer URL  : ${r.offer_url || 'N/A'}
`;
  }).join('\n');

  fs.writeFileSync(filePath, header + body, 'utf8');

  console.log(`[Export] Successfully generated price variance report (${highVariance.length} fails) at:`);
  console.log(`         ${filePath}`);
  return filePath;
}

// Execute if run directly via Node CLI
generatePriceVarianceReport();
