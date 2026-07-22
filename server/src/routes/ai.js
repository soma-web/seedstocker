import { sqlite } from '../db.js';
import { rewriteDescriptionToProse, estimateThcForStrain } from '../rewriter.js';

export default async function aiRoutes(app) {

  // ── Single strain AI description ─────────────────────────────────────────
  app.post('/api/strains/:id/generate-ai-description', async (req, reply) => {
    try {
      const { id } = req.params;
      const strain = sqlite.prepare('SELECT * FROM strains WHERE id = ?').get(id);
      if (!strain) return reply.status(404).send({ error: 'Strain not found' });

      const shopDesc = sqlite.prepare(`
        SELECT description FROM strain_shop_descriptions
        WHERE strain_id = ?
        ORDER BY rowid DESC LIMIT 1
      `).get(id);

      const originalText = shopDesc ? shopDesc.description : '';

      const strainObj = {
        name: strain.name,
        breeder: strain.breeder,
        type: strain.type,
        strainType: strain.strain_type,
        thc: strain.thc,
        cbd: strain.cbd,
        floweringTime: strain.flowering_time
      };

      const result = await rewriteDescriptionToProse(originalText, strainObj);
      if (!result || !result.description) {
        return reply.status(503).send({ error: 'AI generation failed. Check that the local LLM or Gemini API key is configured.' });
      }

      const { description, isAi, modelUsed } = result;
      const now = new Date().toISOString();

      if (isAi) {
        const existing = sqlite.prepare('SELECT strain_id FROM ai_descriptions WHERE strain_id = ?').get(id);
        if (existing) {
          sqlite.prepare('UPDATE ai_descriptions SET description = ?, model_used = ?, updated_at = ? WHERE strain_id = ?')
            .run(description, modelUsed, now, id);
        } else {
          sqlite.prepare('INSERT INTO ai_descriptions (strain_id, description, model_used, updated_at) VALUES (?, ?, ?, ?)')
            .run(id, description, modelUsed, now);
        }
      } else {
        const existing = sqlite.prepare('SELECT strain_id FROM rewritten_descriptions WHERE strain_id = ?').get(id);
        if (existing) {
          sqlite.prepare('UPDATE rewritten_descriptions SET description = ?, updated_at = ? WHERE strain_id = ?')
            .run(description, now, id);
        } else {
          sqlite.prepare('INSERT INTO rewritten_descriptions (strain_id, description, updated_at) VALUES (?, ?, ?)')
            .run(id, description, now);
        }
      }

      return { success: true, isAi, modelUsed: modelUsed || null, description };
    } catch (err) {
      reply.status(500).send({ error: err.message });
    }
  });

  // ── Bulk AI description generation ───────────────────────────────────────
  const bulkAiStatus = {
    isScanning: false,
    startTime: null,
    endTime: null,
    totalStrains: 0,
    processedStrains: 0,
    currentStrain: null,
    logs: [],
    cancelRequested: false
  };

  function bulkAiLogMessage(type, message) {
    const time = new Date().toISOString();
    const logLine = `[${time}][BulkAI][${type.toUpperCase()}] ${message}`;
    console.log(logLine);

    bulkAiStatus.logs.push({ type, message, timestamp: time });
    if (bulkAiStatus.logs.length > 200) {
      bulkAiStatus.logs.shift();
    }
  }

  async function runBulkAiDescriptions(allStrains) {
    for (let i = 0; i < allStrains.length; i++) {
      if (bulkAiStatus.cancelRequested) {
        bulkAiLogMessage('warning', 'Bulk AI description generation cancelled by user.');
        break;
      }

      const strain = allStrains[i];
      bulkAiStatus.currentStrain = strain.name;

      try {
        const shopDesc = sqlite.prepare(`
          SELECT description FROM strain_shop_descriptions
          WHERE strain_id = ?
          ORDER BY rowid DESC LIMIT 1
        `).get(strain.id);

        const originalText = shopDesc ? shopDesc.description : '';
        const strainObj = {
          name: strain.name,
          breeder: strain.breeder,
          type: strain.type,
          strainType: strain.strain_type,
          thc: strain.thc,
          cbd: strain.cbd,
          floweringTime: strain.flowering_time
        };

        const result = await rewriteDescriptionToProse(originalText, strainObj);
        if (result && result.description) {
          const { description, isAi, modelUsed } = result;
          const now = new Date().toISOString();

          if (isAi) {
            const existing = sqlite.prepare('SELECT strain_id FROM ai_descriptions WHERE strain_id = ?').get(strain.id);
            if (existing) {
              sqlite.prepare('UPDATE ai_descriptions SET description = ?, model_used = ?, updated_at = ? WHERE strain_id = ?')
                .run(description, modelUsed, now, strain.id);
            } else {
              sqlite.prepare('INSERT INTO ai_descriptions (strain_id, description, model_used, updated_at) VALUES (?, ?, ?, ?)')
                .run(strain.id, description, modelUsed, now);
            }
            bulkAiLogMessage('success', `[${i + 1}/${allStrains.length}] ${strain.name} - Generated AI description (${modelUsed})`);
          } else {
            const existing = sqlite.prepare('SELECT strain_id FROM rewritten_descriptions WHERE strain_id = ?').get(strain.id);
            if (existing) {
              sqlite.prepare('UPDATE rewritten_descriptions SET description = ?, updated_at = ? WHERE strain_id = ?')
                .run(description, now, strain.id);
            } else {
              sqlite.prepare('INSERT INTO rewritten_descriptions (strain_id, description, updated_at) VALUES (?, ?, ?)')
                .run(strain.id, description, now);
            }
            bulkAiLogMessage('info', `[${i + 1}/${allStrains.length}] ${strain.name} - Generated fallback template description`);
          }
        } else {
          bulkAiLogMessage('error', `[${i + 1}/${allStrains.length}] ${strain.name} - Generation failed (no result)`);
        }
      } catch (err) {
        bulkAiLogMessage('error', `[${i + 1}/${allStrains.length}] ${strain.name} - Error: ${err.message}`);
      }

      bulkAiStatus.processedStrains = i + 1;
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    bulkAiStatus.isScanning = false;
    bulkAiStatus.endTime = new Date().toISOString();
    bulkAiStatus.currentStrain = null;
    if (!bulkAiStatus.cancelRequested) {
      bulkAiLogMessage('success', 'Bulk AI description generation completed successfully.');
    }
  }

  app.post('/api/strains/generate-ai-descriptions', async (req, reply) => {
    try {
      if (bulkAiStatus.isScanning) {
        return reply.status(409).send({ error: 'Bulk AI generation is already running' });
      }

      const allStrains = sqlite.prepare(`
        SELECT s.* FROM strains s
        LEFT JOIN ai_descriptions a ON s.id = a.strain_id
        WHERE a.strain_id IS NULL
      `).all();
      if (allStrains.length === 0) {
        return reply.status(400).send({ error: 'All strains in the database already have AI descriptions.' });
      }

      const { limit } = req.body || {};
      const parsedLimit = limit ? parseInt(limit, 10) : null;

      let strainsToProcess = allStrains;
      if (parsedLimit && !isNaN(parsedLimit) && parsedLimit > 0) {
        strainsToProcess = allStrains.slice(0, parsedLimit);
      }

      bulkAiStatus.isScanning = true;
      bulkAiStatus.startTime = new Date().toISOString();
      bulkAiStatus.endTime = null;
      bulkAiStatus.totalStrains = strainsToProcess.length;
      bulkAiStatus.processedStrains = 0;
      bulkAiStatus.currentStrain = null;
      bulkAiStatus.logs = [];
      bulkAiStatus.cancelRequested = false;

      bulkAiLogMessage('info', `Starting bulk AI description generation for ${strainsToProcess.length} strains...`);

      runBulkAiDescriptions(strainsToProcess).catch(err => {
        bulkAiStatus.isScanning = false;
        bulkAiStatus.endTime = new Date().toISOString();
        bulkAiLogMessage('error', `Bulk run crashed: ${err.message}`);
      });

      return { success: true, message: 'Bulk AI description generation started' };
    } catch (err) {
      bulkAiStatus.isScanning = false;
      bulkAiLogMessage('error', `Failed to start bulk AI generation: ${err.message}`);
      reply.status(500).send({ error: err.message });
    }
  });

  app.get('/api/strains/generate-ai-descriptions/status', async (req, reply) => {
    return bulkAiStatus;
  });

  app.post('/api/strains/generate-ai-descriptions/stop', async (req, reply) => {
    if (!bulkAiStatus.isScanning) {
      return reply.status(400).send({ error: 'Bulk AI generation is not running' });
    }
    bulkAiStatus.cancelRequested = true;
    bulkAiLogMessage('info', 'Cancellation request received. Stopping generation...');
    return { success: true, message: 'Cancellation requested' };
  });

  app.get('/api/strains/missing-ai-description', async (req, reply) => {
    try {
      const count = sqlite.prepare(`
        SELECT COUNT(*) AS count FROM strains s
        LEFT JOIN ai_descriptions a ON s.id = a.strain_id
        WHERE a.strain_id IS NULL
      `).get().count;
      return { count };
    } catch (err) {
      reply.status(500).send({ error: err.message });
    }
  });

  // ── Missing THC Strains Listing ───────────────────────────────────────────
  app.get('/api/strains/missing-thc', async (req, reply) => {
    try {
      const rows = sqlite.prepare(`
        SELECT id, name, breeder, type, seed_type AS seedType, strain_type AS strainType, thc
        FROM strains
        WHERE thc IS NULL OR thc = '' OR thc = 'N/A' OR thc = 'Unknown' OR thc = '?'
        ORDER BY name ASC
      `).all();
      return { count: rows.length, strains: rows };
    } catch (err) {
      reply.status(500).send({ error: err.message });
    }
  });

  // ── Single Strain THC Estimation ──────────────────────────────────────────
  app.post('/api/strains/:id/estimate-thc', async (req, reply) => {
    try {
      const { id } = req.params;
      const strain = sqlite.prepare('SELECT * FROM strains WHERE id = ?').get(id);
      if (!strain) return reply.status(404).send({ error: 'Strain not found' });

      const shopDescs = sqlite.prepare(`
        SELECT description FROM strain_shop_descriptions WHERE strain_id = ?
      `).all(id);

      const result = await estimateThcForStrain(strain, shopDescs);
      return {
        success: true,
        strainId: strain.id,
        name: strain.name,
        breeder: strain.breeder,
        proposedThc: result.thc,
        confidence: result.confidence,
        reasoning: result.reasoning,
        modelUsed: result.modelUsed
      };
    } catch (err) {
      reply.status(500).send({ error: err.message });
    }
  });

  // ── Bulk Strain THC Estimation ────────────────────────────────────────────
  app.post('/api/strains/estimate-thc/bulk', async (req, reply) => {
    try {
      const { limit = 20 } = req.body || {};
      const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

      const missingStrains = sqlite.prepare(`
        SELECT * FROM strains
        WHERE thc IS NULL OR thc = '' OR thc = 'N/A' OR thc = 'Unknown' OR thc = '?'
        ORDER BY name ASC
        LIMIT ?
      `).all(parsedLimit);

      const proposals = [];
      for (const strain of missingStrains) {
        const shopDescs = sqlite.prepare(`
          SELECT description FROM strain_shop_descriptions WHERE strain_id = ?
        `).all(strain.id);

        const result = await estimateThcForStrain(strain, shopDescs);
        if (result && result.thc) {
          proposals.push({
            strainId: strain.id,
            name: strain.name,
            breeder: strain.breeder,
            currentThc: strain.thc,
            proposedThc: result.thc,
            confidence: result.confidence,
            reasoning: result.reasoning,
            modelUsed: result.modelUsed
          });
        }
      }

      return { success: true, count: proposals.length, proposals };
    } catch (err) {
      reply.status(500).send({ error: err.message });
    }
  });
}
