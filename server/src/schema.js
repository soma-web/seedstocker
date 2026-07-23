import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { primaryKey } from 'drizzle-orm/sqlite-core';

export const strains = sqliteTable('strains', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  breeder: text('breeder'),
  type: text('type'), // 'photoperiodic' | 'autoflower'
  seedType: text('seed_type'), // 'feminized' | 'regular'
  thc: text('thc'),
  cbd: text('cbd'),
  strainType: text('strain_type'),
  floweringTime: text('flowering_time'),
  floweringMin: integer('flowering_min'),
  floweringMax: integer('flowering_max'),
  environment: text('environment'), // 'indoor' | 'outdoor' | 'both'
  plantHeight: text('plant_height'),
  harvestMonth: text('harvest_month'),
  effects: text('effects'),
  rating: real('rating'),
  seedfinderUrl: text('seedfinder_url'),
  harvestYield: text('yield'),
  genetics: text('genetics'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const scrapedOffers = sqliteTable('scraped_offers', {
  id: text('id').primaryKey(),
  strainId: text('strain_id').notNull().references(() => strains.id, { onDelete: 'cascade' }),
  shop: text('shop').notNull(), // 'Zamnesia' | 'House of Seeds'
  url: text('url').notNull(),
  seeds: integer('seeds').notNull(), // pack size
  price: real('price').notNull(), // price in EUR
  currency: text('currency').notNull().default('EUR'),
  availability: text('availability').notNull().default('available'), // 'available' | 'orderable' | 'out_of_stock'
  fetchedAt: text('fetched_at').notNull()
});

export const priceHistory = sqliteTable('price_history', {
  id: text('id').primaryKey(),
  strainId: text('strain_id').notNull().references(() => strains.id, { onDelete: 'cascade' }),
  shop: text('shop').notNull(),
  seeds: integer('seeds').notNull(),
  price: real('price').notNull(),
  fetchedAt: text('fetched_at').notNull()
});

// Fixed: composite primary key (issue #15)
export const strainShopDescriptions = sqliteTable('strain_shop_descriptions', {
  strainId: text('strain_id').notNull().references(() => strains.id, { onDelete: 'cascade' }),
  shop: text('shop').notNull(),
  description: text('description').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.strainId, table.shop] })
}));

export const rewrittenDescriptions = sqliteTable('rewritten_descriptions', {
  strainId: text('strain_id').primaryKey().references(() => strains.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const aiDescriptions = sqliteTable('ai_descriptions', {
  strainId: text('strain_id').primaryKey().references(() => strains.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  modelUsed: text('model_used').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const newScrapedEntries = sqliteTable('new_scraped_entries', {
  id: text('id').primaryKey(),
  shop: text('shop').notNull(),
  shopProductUrl: text('shop_product_url').notNull(),
  rawTitle: text('raw_title').notNull(),
  extractedName: text('extracted_name').notNull(),
  extractedBreeder: text('extracted_breeder'),
  seeds: integer('seeds').notNull(),
  price: real('price').notNull(),
  currency: text('currency').notNull().default('EUR'),
  type: text('type'),
  seedType: text('seed_type'),
  thc: text('thc'),
  cbd: text('cbd'),
  strainType: text('strain_type'),
  floweringTime: text('flowering_time'),
  description: text('description'),
  genetics: text('genetics'),
  suggestedStrainId: text('suggested_strain_id'),
  status: text('status').notNull().default('pending'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

