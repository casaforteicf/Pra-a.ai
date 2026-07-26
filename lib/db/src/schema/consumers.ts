import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const consumersTable = pgTable("consumers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertConsumerSchema = createInsertSchema(consumersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertConsumer = z.infer<typeof insertConsumerSchema>;
export type Consumer = typeof consumersTable.$inferSelect;
