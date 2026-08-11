import { pgTable, serial, integer, text, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";
import { consumersTable } from "./consumers";

export const marketplaceListingsTable = pgTable("marketplace_listings", {
  id: serial("id").primaryKey(),
  consumerId: integer("consumer_id").notNull().references(() => consumersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  category: text("category").notNull(),
  condition: text("condition").notNull(),
  imageUrls: jsonb("image_urls").$type<string[]>().notNull().default([]),
  city: text("city").notNull(),
  state: text("state").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type MarketplaceListing = typeof marketplaceListingsTable.$inferSelect;
export type InsertMarketplaceListing = typeof marketplaceListingsTable.$inferInsert;
