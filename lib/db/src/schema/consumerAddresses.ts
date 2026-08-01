import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { consumersTable } from "./consumers";

export const consumerAddressesTable = pgTable("consumer_addresses", {
  id: serial("id").primaryKey(),
  consumerId: integer("consumer_id").notNull().references(() => consumersTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  street: text("street").notNull(),
  number: text("number").notNull(),
  complement: text("complement"),
  neighborhood: text("neighborhood").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ConsumerAddress = typeof consumerAddressesTable.$inferSelect;
