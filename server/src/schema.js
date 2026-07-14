import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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

export const strainShopDescriptions = sqliteTable('strain_shop_descriptions', {
  strainId: text('strain_id').notNull().references(() => strains.id, { onDelete: 'cascade' }),
  shop: text('shop').notNull(),
  description: text('description').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

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


