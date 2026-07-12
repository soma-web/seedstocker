import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const strains = sqliteTable('strains', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  breeder: text('breeder'),
  type: text('type'), // 'photoperiodic' | 'autoflower'
  seedType: text('seed_type'), // 'feminized' | 'regular'
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
