import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, '../config/scraper.json');

function cleanText(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/Zamnesia|Hans Brainfood|House of Seeds|Gas Station Co\.|Sensi Seeds/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getGeminiApiKey() {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.geminiApiKey || null;
    }
  } catch {}
  return null;
}

function readLocalLlmConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        useLocalLlm: !!config.useLocalLlm,
        localLlmUrl: config.localLlmUrl || 'http://localhost:1234/v1/chat/completions',
        localLlmModel: config.localLlmModel || 'local-model'
      };
    }
  } catch {}
  return {
    useLocalLlm: false,
    localLlmUrl: 'http://localhost:1234/v1/chat/completions',
    localLlmModel: 'local-model'
  };
}

export async function rewriteDescriptionToProse(originalText, strain, options = {}) {
  const skipAi = options.skipAi ?? false;
  const localConfig = readLocalLlmConfig();
  
  const prompt = `Du bist ein professioneller Cannabis-Experte und Texter.
Schreibe eine ansprechende, sachliche und einzigartige Sortenbeschreibung auf Deutsch für die folgende Cannabissorte.
Verwende die mitgelieferten strukturierten Eigenschaften sowie die originale Beschreibung als inhaltliche Basis.
Wichtig:
- Der Text MUSS vollständig neu formuliert sein (kein Kopieren der originalen Sätze aus rechtlichen Gründen).
- Der Text soll flüssig als Prosa geschrieben sein (keine Bulletpoints, keine Tabellen).
- Vermeide übertriebenes Marketing-Sprech, bleibe sachlich aber ansprechend.
- Nenne den Züchter (Breeder) und den Sortennamen im Text.
- Baue die Werte für THC, CBD, Typ und Blütezeit ein, falls angegeben.

Sorten-Eigenschaften:
- Name: ${strain.name || 'Unbekannt'}
- Breeder: ${strain.breeder || 'Unbekannt'}
- Typ: ${strain.type === 'autoflower' ? 'Autoflower (selbstblühend)' : 'Photoperiodisch'}
- Genetiktyp: ${strain.strainType || 'Unbekannt'}
- THC-Gehalt: ${strain.thc || 'Nicht angegeben'}
- CBD-Gehalt: ${strain.cbd || 'Nicht angegeben'}
- Blütezeit: ${strain.floweringTime ? strain.floweringTime + ' Wochen' : 'Nicht angegeben'}

Originale Beschreibung als Kontext:
"""
${cleanText(originalText)}
"""

Schreibe genau einen zusammenhängenden Absatz (ca. 4-6 Sätze).`;

  if (!skipAi && localConfig.useLocalLlm) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds timeout
    try {
      console.log(`[Local LLM] Sending request to local inference server: ${localConfig.localLlmUrl} (model: ${localConfig.localLlmModel})`);
      const response = await fetch(localConfig.localLlmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: localConfig.localLlmModel,
          messages: [
            {
              role: 'system',
              content: 'Du bist ein professioneller Cannabis-Experte und Texter. Schreibe sachliche und ansprechende Beschreibungen auf Deutsch.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (text && text.trim()) {
          console.log(`[Local LLM] Successfully generated description for ${strain.name}`);
          return {
            description: text.replace(/\n+/g, ' ').trim(),
            isAi: true,
            modelUsed: localConfig.localLlmModel
          };
        }
      } else {
        console.error(`[Local LLM] Server returned status ${response.status}: ${await response.text()}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(`[Local LLM] Connection failed: ${err.message}`);
    }
  }

  const apiKey = skipAi ? null : getGeminiApiKey();
  if (apiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiText && aiText.trim()) {
          return {
            description: aiText.replace(/\n+/g, ' ').trim(),
            isAi: true,
            modelUsed: 'gemini-2.0-flash'
          };
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      // Bypassed: silent fallback
    }
  }

  const clean = cleanText(originalText).toLowerCase();

  const name = strain.name || 'Diese Sorte';
  const breeder = strain.breeder || 'renommierte Züchter';
  const type = strain.type === 'autoflower' ? 'selbstblühende' : 'photoperiodische';
  const seedType = strain.seedType === 'feminized' ? 'feminisierte' : 'reguläre';

  // 1. Intro Sentence
  const s1 = `Die Sorte ${name} ist eine von ${breeder} entwickelte, ${type} Cannabissorte, die als ${seedType} Samen kultiviert werden kann.`;

  // 2. Genetics Lineage Sentence
  let s2 = '';
  const isKush = clean.includes('kush');
  const isHaze = clean.includes('haze');
  const isSkunk = clean.includes('skunk');
  
  if (strain.strainType) {
    const formattedType = strain.strainType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    s2 = `Sie wird als ${formattedType} eingestuft und vereint klassische Eigenschaften dieser genetischen Linie.`;
  } else {
    s2 = `Genetisch präsentiert sie sich als ausgewogene Varietät mit stabilen Wuchseigenschaften.`;
  }

  if (isKush) {
    s2 += ` Der Einfluss traditioneller Kush-Genetik verleiht der Pflanze eine gedrungene Struktur und dichte Blütenstände.`;
  } else if (isHaze) {
    s2 += ` Dank des Haze-Einflusses zeigt sie ein vitales Höhenwachstum und elastische Verzweigungen.`;
  } else if (isSkunk) {
    s2 += ` Die robuste Skunk-Linie sorgt für eine hervorragende Widerstandsfähigkeit im Wuchs.`;
  }

  // 3. Aroma and Terpene Profile
  let s3 = '';
  const isCitrus = clean.includes('zitrus') || clean.includes('lemon') || clean.includes('citrus') || clean.includes('limone');
  const isSweet = clean.includes('süß') || clean.includes('sweet') || clean.includes('beere') || clean.includes('berry') || clean.includes('frucht') || clean.includes('fruit');
  const isEarth = clean.includes('erdig') || clean.includes('earthy') || clean.includes('wald') || clean.includes('kiefer') || clean.includes('pine');
  const isFuel = clean.includes('diesel') || clean.includes('fuel') || clean.includes('kraftstoff') || clean.includes('herbe');

  if (isCitrus) {
    s3 = `Ihr Geruchsprofil zeichnet sich durch frische Zitrusaromen aus, begleitet von spritzigen Säurenoten.`;
  } else if (isSweet) {
    s3 = `Das Aroma besticht durch eine ausgeprägte fruchtige Süße, die an reife Beeren und Sommerfrüchte erinnert.`;
  } else if (isEarth) {
    s3 = `Aromatisch dominieren waldige Holznoten und ein charakteristisch erdiger Unterton in den Harzkristallen.`;
  } else if (isFuel) {
    s3 = `Die Blüten verströmen eine intensive, kraftstoffartige Note mit herben Nuancen beim Ausreifen.`;
  } else {
    s3 = `Das Terpenprofil verströmt eine angenehm kräuterige Note mit holzigen und würzigen Untertönen.`;
  }

  // 4. Cannabinoids and Effects
  let s4 = '';
  const hasThc = !!strain.thc;
  const hasCbd = !!strain.cbd;
  const isHead = clean.includes('high') || clean.includes('kopf') || clean.includes('kreativ') || clean.includes('energy') || clean.includes('fokus');
  const isBody = clean.includes('entspann') || clean.includes('relax') || clean.includes('körper') || clean.includes('sleep') || clean.includes('schlaf');

  let strengthIntro = '';
  if (hasThc && hasCbd) {
    strengthIntro = `Mit einem THC-Gehalt von ${strain.thc} und einem CBD-Wert von ${strain.cbd}`;
  } else if (hasThc) {
    strengthIntro = `Mit einem THC-Gehalt von ca. ${strain.thc}`;
  } else if (hasCbd) {
    strengthIntro = `Mit einem ausgeprägten CBD-Gehalt von ${strain.cbd}`;
  } else {
    strengthIntro = `Im Konsum`;
  }

  let effectText = '';
  if (isHead && isBody) {
    effectText = `bewirkt sie ein harmonisch ausgewogenes Konsumerlebnis, das sowohl geistige Klarheit als auch tiefe körperliche Entspannung vereint`;
  } else if (isHead) {
    effectText = `induziert sie ein primär geistig anregendes, klares Kopf-High, welches die Kreativität und den Fokus fördern kann`;
  } else if (isBody) {
    effectText = `führt sie zu einer spürbaren körperlichen Entspannung, die beruhigend, stresslindernd und regenerierend wirkt`;
  } else {
    effectText = `bietet sie eine angenehm ausgewogene Wirkung, die sich ideal für den alltäglichen Genuss eignet`;
  }
  s4 = `${strengthIntro} ${effectText}.`;

  // 5. Flowering Time and Cultivation Difficulty
  let s5 = '';
  const isEasy = clean.includes('einfach') || clean.includes('anfänger') || clean.includes('easy') || clean.includes('robust') || clean.includes('widerstand');
  
  if (strain.floweringTime) {
    s5 = `Die Blütezeit dieser Varietät beträgt schätzungsweise ${strain.floweringTime} Wochen.`;
  } else if (strain.floweringMin && strain.floweringMax) {
    s5 = `Die Pflanze benötigt eine Blühphase von etwa ${strain.floweringMin} bis ${strain.floweringMax} Wochen, um ihre volle Reife zu erlangen.`;
  } else {
    s5 = `Der Wuchs- und Blühzyklus verhält sich typisch und berechenbar für diese Genetikklasse.`;
  }

  if (isEasy) {
    s5 += ` Dank ihrer robusten Widerstandsfähigkeit eignet sich die Sorte hervorragend für Anbauer aller Erfahrungsstufen.`;
  }

  return {
    description: `${s1} ${s2} ${s3} ${s4} ${s5}`,
    isAi: false
  };
}
