import { getGeminiApiKey, getLocalLlmConfig, getChatgptApiKey, getChatgptConfig } from './config.js';

function cleanText(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/Zamnesia|Hans Brainfood|House of Seeds|Gas Station Co\.|Sensi Seeds|Dutch Passion/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function rewriteDescriptionToProse(originalText, strain, options = {}) {
  const skipAi = options.skipAi ?? false;
  const localConfig = getLocalLlmConfig();
  const chatgptConfig = getChatgptConfig();
  const chatgptApiKey = skipAi ? null : getChatgptApiKey();
  
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
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 180 seconds timeout
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

  if (!skipAi && chatgptConfig.useChatGpt && chatgptApiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout
    try {
      console.log(`[ChatGPT] Sending request to OpenAI API: https://api.openai.com/v1/chat/completions (model: ${chatgptConfig.chatgptModel})`);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${chatgptApiKey}`
        },
        body: JSON.stringify({
          model: chatgptConfig.chatgptModel,
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
          console.log(`[ChatGPT] Successfully generated description for ${strain.name}`);
          return {
            description: text.replace(/\n+/g, ' ').trim(),
            isAi: true,
            modelUsed: chatgptConfig.chatgptModel
          };
        }
      } else {
        console.error(`[ChatGPT] OpenAI API returned status ${response.status}: ${await response.text()}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(`[ChatGPT] Connection failed: ${err.message}`);
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

/**
 * Estimate THC content for a strain using active LLMs (Local LLM, ChatGPT, or Gemini).
 */
export async function estimateThcForStrain(strain, shopDescriptions = []) {
  const localConfig = getLocalLlmConfig();
  const chatgptConfig = getChatgptConfig();
  const chatgptApiKey = getChatgptApiKey();
  const geminiApiKey = getGeminiApiKey();

  const descContext = Array.isArray(shopDescriptions)
    ? shopDescriptions.map(d => (typeof d === 'string' ? d : d.description)).filter(Boolean).join('\n---\n')
    : String(shopDescriptions || '');

  const prompt = `Du bist ein erfahrener Cannabis-Experte und Datenanalyst.
Wir suchen den typischen THC-Gehalt (in %) für die folgende Cannabissorte:
- Sortenname: ${strain.name || 'Unbekannt'}
- Breeder / Züchter: ${strain.breeder || 'Unbekannt'}
- Typ: ${strain.type || 'Unbekannt'}
- Genetik: ${strain.strainType || strain.strain_type || 'Unbekannt'}

Zusätzliche Shop-Beschreibungen als Kontext:
"""
${cleanText(descContext)}
"""

Aufgabe:
Analysiere die Angaben und dein Fachwissen zu dieser Sorte von diesem Züchter.
Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt im folgenden Format:
{
  "thc": "22%" (oder "18-24%" oder null falls unbekannt),
  "confidence": "high" (oder "medium" oder "low"),
  "reasoning": "Kurze Begründung auf Deutsch (max 1-2 Sätze)"
}`;

  function parseLlmJson(rawText) {
    if (!rawText) return null;
    try {
      const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === 'object') {
        let thc = parsed.thc ? String(parsed.thc).trim() : null;
        if (thc && !thc.endsWith('%') && /^\d+(?:-\d+)?$/.test(thc)) {
          thc += '%';
        }
        return {
          thc: thc || null,
          confidence: parsed.confidence || 'medium',
          reasoning: parsed.reasoning || 'Auf Basis der Sorten-Informationen geschätzt.'
        };
      }
    } catch {}
    
    // Regex fallback if LLM returned text instead of pure JSON
    const thcMatch = rawText.match(/(\d{1,2}(?:\.\d+)?\s*(?:-\s*\d{1,2}(?:\.\d+)?)?\s*%)/);
    if (thcMatch) {
      return {
        thc: thcMatch[1].replace(/\s+/g, ''),
        confidence: 'medium',
        reasoning: 'Aus der Antwort des Modells extrahiert.'
      };
    }
    return null;
  }

  // 1. Local LLM
  if (localConfig.useLocalLlm) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(localConfig.localLlmUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: localConfig.localLlmModel,
          messages: [
            { role: 'system', content: 'Du antwortest ausschließlich in gültigem JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        const res = parseLlmJson(text);
        if (res) return { ...res, modelUsed: localConfig.localLlmModel };
      }
    } catch (err) {
      clearTimeout(timeoutId);
    }
  }

  // 2. ChatGPT
  if (chatgptConfig.useChatGpt && chatgptApiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${chatgptApiKey}`
        },
        body: JSON.stringify({
          model: chatgptConfig.chatgptModel,
          messages: [
            { role: 'system', content: 'Du antwortest ausschließlich in gültigem JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        const res = parseLlmJson(text);
        if (res) return { ...res, modelUsed: chatgptConfig.chatgptModel };
      }
    } catch (err) {
      clearTimeout(timeoutId);
    }
  }

  // 3. Gemini
  if (geminiApiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const res = parseLlmJson(text);
        if (res) return { ...res, modelUsed: 'gemini-2.0-flash' };
      }
    } catch (err) {
      clearTimeout(timeoutId);
    }
  }

  return {
    thc: null,
    confidence: 'low',
    reasoning: 'Keine KI-Antwort verfügbar oder kein THC-Wert in Datenbank/Kontext gefunden.',
    modelUsed: null
  };
}
