import crypto from 'node:crypto';
import { getConfig } from './config.js';
import { SCRAPER_REGISTRY, getScraperByName } from './scrapers/registry.js';

export let sanityCheckStatus = {
  isRunning: false,
  shop: null,
  progress: 0,
  total: 0,
  logs: [],
  results: null
};

function getShopUrlFromConfig(shopName) {
  try {
    const config = getConfig();
    const shopConf = config.shops?.find(s => {
      if (typeof s === 'string') return s.toLowerCase() === shopName.toLowerCase();
      return s && s.name && s.name.toLowerCase() === shopName.toLowerCase();
    });
    if (shopConf && typeof shopConf === 'object' && shopConf.url) {
      return shopConf.url;
    }
  } catch (err) {
    console.error('Error reading scraper config for sanity check:', err);
  }
  
  // Fallback: use defaultUrl from registry
  const entry = getScraperByName(shopName);
  if (entry && entry.defaultUrl) {
    return entry.defaultUrl;
  }

  // Legacy fallbacks
  if (shopName === 'Zamnesia') return 'https://www.zamnesia.de/35-cannabissamen/295-feminisiert-hanfsamen, https://www.zamnesia.de/35-cannabissamen/294-autoflowering-hanfsamen';
  return null;
}

export async function startSanityCheck(shopName) {
  if (sanityCheckStatus.isRunning) {
    throw new Error('A sanity check is already running.');
  }

  // Reset status
  sanityCheckStatus.isRunning = true;
  sanityCheckStatus.shop = shopName;
  sanityCheckStatus.progress = 0;
  sanityCheckStatus.total = 0;
  sanityCheckStatus.logs = [];
  sanityCheckStatus.results = {
    totalStrains: 0,
    totalOffers: 0,
    critical: {
      name: { success: 0, fail: 0 },
      breeder: { success: 0, fail: 0 },
      price: { success: 0, fail: 0 },
      seeds: { success: 0, fail: 0 }
    },
    secondary: {
      thc: { success: 0, fail: 0 },
      cbd: { success: 0, fail: 0 },
      strainType: { success: 0, fail: 0 },
      seedType: { success: 0, fail: 0 },
      type: { success: 0, fail: 0 }
    },
    failures: [],
    criticalFailures: [],
    secondaryFailures: []
  };

  const addLog = (level, msg) => {
    const time = new Date().toLocaleTimeString();
    sanityCheckStatus.logs.push(`[${time}] [${level.toUpperCase()}] ${msg}`);
  };

  addLog('info', `Starting sanity check for shop: ${shopName}`);

  // Run in background
  (async () => {
    try {
      // Use registry to find the scraper (issue #5, #13)
      const entry = getScraperByName(shopName);
      if (!entry) {
        throw new Error(`Unknown shop name: ${shopName}. Available: ${SCRAPER_REGISTRY.map(e => e.name).join(', ')}`);
      }

      const scraper = new entry.ScraperClass((level, msg) => addLog(level, msg));

      const configuredUrl = getShopUrlFromConfig(shopName);
      if (!configuredUrl) {
        throw new Error(`No URL configured for ${shopName} in scraper.json or registry`);
      }

      // Gather random URLs
      let urls = [];
      addLog('info', 'Gathering shop product catalog URL list...');
      
      if (entry.shopifyJson) {
        // Shopify-based shops
        const baseUrl = configuredUrl.replace(/\/products\.json$/, '').replace(/\/$/, '');
        const res = await fetch(`${baseUrl}/products.json?limit=250`);
        if (!res.ok) throw new Error(`Failed to fetch shop products.json: status ${res.status}`);
        const data = await res.json();
        if (!data.products || !Array.isArray(data.products)) throw new Error('Invalid products.json structure');
        urls = data.products.map(p => ({
          url: `${baseUrl}/products/${p.handle}`,
          type: p.title.toLowerCase().includes('auto') ? 'autoflower' : 'photoperiodic',
          seedType: (p.title.toLowerCase().includes('regular') || p.title.toLowerCase().includes('regulär')) ? 'regular' : 'feminized'
        }));
      } else if (shopName === 'Zamnesia') {
        const catUrls = configuredUrl.split(',').map(u => u.trim()).filter(Boolean).map(u => {
          let type = 'photoperiodic';
          let seedType = 'feminized';
          const lower = u.toLowerCase();
          if (lower.includes('autoflowering') || lower.includes('auto') || lower.includes('f1-samen') || lower.includes('f1')) {
            type = 'autoflower';
          }
          if (lower.includes('regulare') || lower.includes('regular') || lower.includes('regulär')) {
            seedType = 'regular';
          }
          return { url: u, type, seedType };
        });
        
        for (const cat of catUrls) {
          addLog('info', `Fetching category page: ${cat.url}`);
          const res = await fetch(cat.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
            }
          });
          if (!res.ok) {
            addLog('warning', `Failed to crawl Zamnesia category ${cat.url}: status ${res.status}`);
            continue;
          }
          const html = await res.text();
          const pageProductUrls = [];
          const re1 = /<a\b[^>]*?class=["'][^"']*?product_link[^"']*?["'][^>]*?href=["'](https:\/\/www\.zamnesia\.de\/\d+-[^"']+\.html)["']/gi;
          const re2 = /<a\b[^>]*?href=["'](https:\/\/www\.zamnesia\.de\/\d+-[^"']+\.html)["'][^>]*?class=["'][^"']*?product_link[^"']*?["']/gi;
          let match;
          while ((match = re1.exec(html)) !== null) pageProductUrls.push(match[1]);
          while ((match = re2.exec(html)) !== null) pageProductUrls.push(match[1]);
          
          const unique = [...new Set(pageProductUrls)];
          unique.forEach(url => {
            if (!url.includes('mystery-box') && !url.includes('headshop') && !url.includes('vaporizer')) {
              urls.push({ url, type: cat.type, seedType: cat.seedType });
            }
          });
        }
      } else if (shopName === 'Sensi Seeds') {
        addLog('info', `Fetching Sensi Seeds catalog page: ${configuredUrl}`);
        const res = await fetch(configuredUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'de-DE,de;q=0.9'
          }
        });
        if (res.ok) {
          const html = await res.text();
          const itemBoxes = html.split(/<div class="product-item"|<div class="item-box"/i).slice(1);
          const set = new Set();
          for (const box of itemBoxes) {
            const match = box.match(/href="(\/de\/[^"]+)"/);
            if (match && !match[1].includes('shoppingcart') && !match[1].includes('wishlist') && !match[1].includes('account')) {
              const full = match[1].startsWith('http') ? match[1] : `https://sensiseeds.com${match[1]}`;
              set.add(full);
            }
          }
          set.forEach(url => urls.push({ url, type: 'photoperiodic', seedType: 'feminized' }));
        }
      } else if (shopName === 'Dutch Passion') {
        addLog('info', `Fetching Dutch Passion catalog page: ${configuredUrl}`);
        const res = await fetch(configuredUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'de-DE,de;q=0.9'
          }
        });
        if (res.ok) {
          const html = await res.text();
          const linkRe = /href=["'](https?:\/\/dutch-passion\.com\/de\/hanfsamen\/[^"']+)["']/gi;
          const set = new Set();
          let match;
          while ((match = linkRe.exec(html)) !== null) {
            if (!match[1].includes('page=') && !match[1].includes('?')) {
              set.add(match[1]);
            }
          }
          set.forEach(url => urls.push({ url, type: 'photoperiodic', seedType: 'feminized' }));
        }
      }

      if (urls.length === 0) {
        throw new Error('No product URLs gathered for sanity check.');
      }

      // Shuffle and sample up to 50 URLs
      urls = urls.sort(() => 0.5 - Math.random());
      const sampleSize = Math.min(urls.length, 50);
      const sample = urls.slice(0, sampleSize);
      sanityCheckStatus.total = sampleSize;
      addLog('info', `Selected ${sampleSize} random product pages for sampling.`);

      // Intercept DB writes
      const parsedStrains = new Map();
      const parsedOffers = [];

      scraper.upsertStrain = async (data) => {
        const mockId = crypto.randomUUID();
        parsedStrains.set(mockId, { ...data, id: mockId });
        return mockId;
      };

      scraper.insertOffer = async (data) => {
        parsedOffers.push(data);
      };

      // Loop & Scrape Single
      const results = sanityCheckStatus.results;
      for (let i = 0; i < sample.length; i++) {
        const item = sample[i];
        addLog('info', `[${i + 1}/${sampleSize}] Scraping page: ${item.url}`);
        
        parsedStrains.clear();
        parsedOffers.length = 0;

        try {
          await scraper.scrapeSingle(item.url);
          
          const strain = Array.from(parsedStrains.values())[0];
          const itemCriticalFails = [];
          const itemSecondaryFails = [];
          
          if (strain) {
            results.totalStrains++;
            
            // Name
            if (strain.name && strain.name !== 'Unknown') {
              results.critical.name.success++;
            } else {
              results.critical.name.fail++;
              itemCriticalFails.push('name');
              addLog('warning', `Missing critical info: Name parsed as: "${strain.name}"`);
            }
            
            // Breeder
            if (strain.breeder && strain.breeder !== 'Unknown') {
              results.critical.breeder.success++;
            } else {
              results.critical.breeder.fail++;
              itemCriticalFails.push('breeder');
              addLog('warning', `Missing critical info: Breeder parsed as: "${strain.breeder}"`);
            }
            
            // THC
            if (strain.thc !== null && strain.thc !== undefined) {
              results.secondary.thc.success++;
            } else {
              results.secondary.thc.fail++;
              itemSecondaryFails.push('thc');
            }
            
            // CBD
            if (strain.cbd !== null && strain.cbd !== undefined) {
              results.secondary.cbd.success++;
            } else {
              results.secondary.cbd.fail++;
              itemSecondaryFails.push('cbd');
            }
            
            // Genetics (strainType)
            if (strain.strainType !== null && strain.strainType !== undefined) {
              results.secondary.strainType.success++;
            } else {
              results.secondary.strainType.fail++;
              itemSecondaryFails.push('genetics');
            }
            
            // Seed Type
            if (strain.seedType !== null && strain.seedType !== undefined) {
              results.secondary.seedType.success++;
            } else {
              results.secondary.seedType.fail++;
              itemSecondaryFails.push('seedType');
            }
            
            // Auto/Photo type
            if (strain.type !== null && strain.type !== undefined) {
              results.secondary.type.success++;
            } else {
              results.secondary.type.fail++;
              itemSecondaryFails.push('type');
            }
          } else {
            results.critical.name.fail++;
            results.critical.breeder.fail++;
            itemCriticalFails.push('name', 'breeder');
            addLog('warning', 'No strain information upserted during scrape.');
          }

          // Offers / Price & Seeds
          if (parsedOffers.length > 0) {
            results.totalOffers += parsedOffers.length;
            
            let priceValid = true;
            let seedsValid = true;
            parsedOffers.forEach(o => {
              if (o.price === null || o.price === undefined || isNaN(o.price) || o.price <= 0) priceValid = false;
              if (o.seeds === null || o.seeds === undefined || isNaN(o.seeds) || o.seeds <= 0) seedsValid = false;
            });
            
            if (priceValid) {
              results.critical.price.success++;
            } else {
              results.critical.price.fail++;
              itemCriticalFails.push('price');
              addLog('warning', 'Invalid offer price detected.');
            }
            
            if (seedsValid) {
              results.critical.seeds.success++;
            } else {
              results.critical.seeds.fail++;
              itemCriticalFails.push('seeds');
              addLog('warning', 'Invalid offer seed count detected.');
            }
          } else {
            results.critical.price.fail++;
            results.critical.seeds.fail++;
            itemCriticalFails.push('price', 'seeds');
            addLog('warning', 'No offers parsed for this product.');
          }

          if (itemCriticalFails.length > 0) {
            results.criticalFailures.push({
              url: item.url,
              fields: itemCriticalFails
            });
          }

          if (itemSecondaryFails.length > 0) {
            results.secondaryFailures.push({
              url: item.url,
              fields: itemSecondaryFails
            });
          }

        } catch (err) {
          addLog('error', `Scrape failure on ${item.url}: ${err.message}`);
          results.failures.push({ url: item.url, error: err.message });
          
          results.critical.name.fail++;
          results.critical.breeder.fail++;
          results.critical.price.fail++;
          results.critical.seeds.fail++;
        }

        sanityCheckStatus.progress = i + 1;
        // Small delay between checks to avoid rate limit bans
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      addLog('info', `Sanity check completed. Strains checked: ${results.totalStrains}, Offers found: ${results.totalOffers}.`);
    } catch (err) {
      addLog('error', `Global runner failure: ${err.message}`);
    } finally {
      sanityCheckStatus.isRunning = false;
    }
  })();
}
