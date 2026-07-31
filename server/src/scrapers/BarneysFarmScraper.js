import { BaseScraper } from './BaseScraper.js';

export class BarneysFarmScraper extends BaseScraper {
  constructor(logMessage, scrapeMode = 'price') {
    super("Barney's Farm", logMessage, scrapeMode);
    this.baseUrl = 'https://www.barneysfarm.de';
  }

  getHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cookie': 'country=DE; currency=EUR; store=de'
    };
  }

  async scrape(scraperStatus, targetUrl = null) {
    this.log('info', 'Starting Barney\'s Farm scraper (Target Country: Germany / EUR)...');
    scraperStatus.currentShop = this.shopName;

    const productPageMap = new Map(); // url => { type, seedType }

    const isSingleProductUrl = (u) => {
      return /https:\/\/www\.barneysfarm\.de\/[a-z0-9\-]+-\d+$/i.test(u) && !u.includes('sitemap');
    };

    if (targetUrl && isSingleProductUrl(targetUrl)) {
      const urls = targetUrl.split(',').map(u => u.trim()).filter(Boolean);
      for (const u of urls) {
        if (isSingleProductUrl(u)) {
          let type = 'photoperiodic';
          let seedType = 'feminized';
          const lower = u.toLowerCase();
          if (lower.includes('auto')) type = 'autoflower';
          if (lower.includes('regular')) seedType = 'regular';
          productPageMap.set(u, { type, seedType });
        }
      }
    } else {
      // 1. Crawl sitemap.xml
      this.log('info', 'Fetching Barney\'s Farm sitemap.xml...');
      try {
        const smRes = await this.fetchWithRetry(`${this.baseUrl}/sitemap.xml`, { headers: this.getHeaders() });
        if (smRes && smRes.ok) {
          const smText = await smRes.text();
          const locs = (smText.match(/<loc>(.*?)<\/loc>/g) || []).map(l => l.replace(/<\/?loc>/g, ''));
          for (const loc of locs) {
            if (/https:\/\/www\.barneysfarm\.de\/[a-z0-9\-]+-\d+$/i.test(loc)) {
              let type = 'photoperiodic';
              let seedType = 'feminized';
              const lower = loc.toLowerCase();
              if (lower.includes('auto')) type = 'autoflower';
              if (lower.includes('regular')) seedType = 'regular';
              productPageMap.set(loc, { type, seedType });
            }
          }
          this.log('info', `Found ${productPageMap.size} product URLs in sitemap.xml`);
        }
      } catch (err) {
        this.log('error', `Failed fetching sitemap.xml: ${err.message}`);
      }

      // 2. Crawl main categories for additional URLs & taxonomy hints
      const categories = [
        { url: `${this.baseUrl}/autoflowering-samen`, type: 'autoflower', seedType: 'feminized' },
        { url: `${this.baseUrl}/indica-hanfsamen`, type: 'photoperiodic', seedType: 'feminized' },
        { url: `${this.baseUrl}/sativa-hanfsamen`, type: 'photoperiodic', seedType: 'feminized' },
        { url: `${this.baseUrl}/regular-samen`, type: 'photoperiodic', seedType: 'regular' },
        { url: `${this.baseUrl}/cali-kollektion`, type: 'photoperiodic', seedType: 'feminized' },
        { url: `${this.baseUrl}/high-yield-kollektion`, type: 'photoperiodic', seedType: 'feminized' },
        { url: `${this.baseUrl}/amsterdam-classics`, type: 'photoperiodic', seedType: 'feminized' }
      ];

      for (const cat of categories) {
        try {
          const res = await this.fetchWithRetry(cat.url, { headers: this.getHeaders() });
          if (res && res.ok) {
            const html = await res.text();
            const matches = html.match(/href=["'](https:\/\/www\.barneysfarm\.de\/[a-z0-9\-]+-\d+)["']/gi) || [];
            for (const m of matches) {
              const url = m.replace(/^href=["']|["']$/g, '');
              if (!productPageMap.has(url)) {
                productPageMap.set(url, { type: cat.type, seedType: cat.seedType });
              }
            }
          }
        } catch (err) {
          this.log('warning', `Failed fetching category ${cat.url}: ${err.message}`);
        }
      }
    }

    const limit = this.getLimit();
    const productList = limit !== null
      ? Array.from(productPageMap.entries()).slice(0, limit)
      : Array.from(productPageMap.entries());

    this.log('info', `Total unique product pages queued for Barney's Farm: ${productList.length}`);

    await this.clearOffers();

    for (const [url, meta] of productList) {
      try {
        await this.scrapeSingle(url, meta, scraperStatus);
      } catch (err) {
        this.log('error', `Failed scraping page ${url}: ${err.message}`);
      }
      await this.sleep(300);
    }

    this.log('info', `Barney's Farm scraper finished successfully. Scraped ${scraperStatus.productsScraped} offers.`);
  }

  async scrapeSingle(url, meta = {}, scraperStatus = { productsScraped: 0 }) {
    this.log('info', `Running single page scrape for: ${url}`);

    let res;
    try {
      res = await this.fetchWithRetry(url, { headers: this.getHeaders() });
    } catch (err) {
      throw new Error(`Failed fetching page: ${err.message}`);
    }

    if (!res || !res.ok) {
      throw new Error(`Failed scraping page status ${res ? res.status : 'no-response'}`);
    }

    const html = await res.text();

    // H1 title
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (!h1Match) {
      throw new Error('Could not find H1 title on page');
    }

    const rawTitle = h1Match[1].replace(/<[^>]+>/g, '').trim();
    if (this.isInvalidStrainName(rawTitle, html, "Barney's Farm")) {
      this.log('info', `Skipping invalid/merchandise product: ${rawTitle}`);
      return null;
    }

    scraperStatus.currentProduct = rawTitle;

    // Cleaned strain name
    let cleanTitle = rawTitle.replace(/\s+Strain\b/i, '').replace(/\s+Samen\b/i, '').trim();
    let strainName = this.normalizeStrainName(cleanTitle, "Barney's Farm");
    if (!strainName) strainName = cleanTitle;

    // Extract JSON-LD description
    let description = null;
    const jsonLdMatch = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const data = JSON.parse(jsonLdMatch[1]);
        if (data.description) {
          description = data.description.replace(/&nbsp;/g, ' ').replace(/&rsquo;/g, "'").replace(/&amp;/g, '&');
        }
      } catch (e) {}
    }

    // Spec tables extraction
    const specs = {};
    const trMatches = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const tr of trMatches) {
      const tdMatches = tr.match(/<td\b[^>]*>([\s\S]*?)(?:<\/td>|(?=<\/tr>))/gi) || [];
      if (tdMatches.length >= 2) {
        const key = tdMatches[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        const val = tdMatches[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        specs[key] = val;
      }
    }

    let thc = null;
    let cbd = null;
    let genetics = null;
    let sativaPct = null;
    let indicaPct = null;
    let strainType = null;
    let floweringTime = null;
    let type = meta.type || 'photoperiodic';
    let seedType = meta.seedType || 'feminized';

    for (const [k, v] of Object.entries(specs)) {
      if (k.includes('genetik')) genetics = v;
      if (k.includes('thc')) thc = this.cleanThc(v);
      if (k.includes('cbd')) cbd = this.cleanCbd(v);
      if (k.includes('sativa')) {
        const m = v.match(/(\d+)/);
        if (m) sativaPct = parseInt(m[1], 10);
      }
      if (k.includes('indica')) {
        const m = v.match(/(\d+)/);
        if (m) indicaPct = parseInt(m[1], 10);
      }
      if (k.includes('blütezeit')) floweringTime = this.cleanFloweringTime(v);
      if (k === 'typ') {
        if (v.toLowerCase().includes('auto')) type = 'autoflower';
        if (v.toLowerCase().includes('regulär') || v.toLowerCase().includes('regular')) seedType = 'regular';
      }
    }

    if (sativaPct !== null && indicaPct !== null) {
      if (sativaPct > indicaPct + 10) strainType = 'sativa-dominant';
      else if (indicaPct > sativaPct + 10) strainType = 'indica-dominant';
      else strainType = 'hybrid';
    }

    const lowerUrl = url.toLowerCase();
    const lowerRaw = rawTitle.toLowerCase();
    if (lowerUrl.includes('auto') || lowerRaw.includes('auto')) {
      type = 'autoflower';
    }
    if (lowerUrl.includes('regular') || lowerRaw.includes('regular') || lowerRaw.includes('regulär')) {
      seedType = 'regular';
    }

    const strainId = await this.upsertStrain({
      name: strainName,
      breeder: "Barney's Farm",
      type,
      seedType,
      thc,
      cbd,
      strainType,
      floweringTime,
      description,
      genetics,
      url,
      rawTitle
    });

    // Parse offers
    const rawOffers = this.parseOffersFromHtml(html);
    let offersCreated = 0;
    for (const off of rawOffers) {
      await this.insertOffer({
        strainId,
        url,
        seeds: off.seeds,
        price: off.price,
        availability: 'available'
      });
      offersCreated++;
      scraperStatus.productsScraped++;
    }

    return {
      strainId,
      name: strainName,
      breeder: "Barney's Farm",
      offersCreated,
    };
  }

  parseOffersFromHtml(html) {
    const offers = [];
    const liMatches = html.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || [];
    const packLis = liMatches.filter(li => li.includes('packsize_num') || li.includes('packsize_price'));

    for (const li of packLis) {
      const numMatch = li.match(/class=["']packsize_num["'][^>]*>([\s\S]*?)<\/span>/i);
      const priceMatch = li.match(/class=["']packsize_price["'][^>]*>([\s\S]*?)<\/span>/i);

      const numText = numMatch ? numMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      let priceText = priceMatch ? priceMatch[1].replace(/<[^>]+>/g, '').replace('&euro;', '€').trim() : '';

      // Strip sale / line-through price if original higher price is shown in span style
      priceText = priceText.replace(/<span[^>]*style="[^"]*line-through[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');

      const seedsMatch = numText.match(/(\d+)/);
      const seeds = seedsMatch ? parseInt(seedsMatch[1], 10) : 1;

      const pMatch = priceText.match(/([\d.,]+)/);
      const price = pMatch ? parseFloat(pMatch[1].replace(',', '.')) : 0;

      if (seeds > 0 && price > 0) {
        offers.push({ seeds, price });
      }
    }

    return offers;
  }
}
