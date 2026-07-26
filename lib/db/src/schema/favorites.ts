import { pgTable, text, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { consumersTable } from "./consumers";

export const favoritesTable = pgTable(
  "favorites",
  {
    id: serial("id").primaryKey(),
    consumerId: integer("consumer_id").notNull().references(() => consumersTable.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("favorites_consumer_product").on(t.consumerId, t.productId)],
);

export type Favorite = typeof favoritesTable.$inferSelect;
