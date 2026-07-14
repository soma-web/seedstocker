import { ShopifyScraper } from './ShopifyScraper.js';

export class HouseOfSeedsScraper extends ShopifyScraper {
  constructor(logMessage, scrapeMode = 'price') {
    super('House of Seeds', logMessage, scrapeMode);
  }

  parseMetafieldsFromHtml(html) {
    const specs = super.parseMetafieldsFromHtml(html);

    if (!specs.strainType) {
      const iconsRowRe = /<h3[^>]*class=["']icons-row-item__title["'][^>]*>([\s\S]*?)<\/h3>[\s\S]*?<div[^>]*class=["']icons-row-item(?:__text)?["'][^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/gi;
      let match;
      while ((match = iconsRowRe.exec(html)) !== null) {
        const title = match[1].replace(/<[^>]+>/g, ' ').trim().toLowerCase();
        const valueText = match[2].replace(/<[^>]+>/g, ' ').trim();
        if (title.includes('sativa / indica') || title.includes('genetics') || title.includes('genetik') || title.includes('typ')) {
          specs.strainType = valueText;
          break;
        }
      }
    }

    return specs;
  }
}
