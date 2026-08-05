import { pgTable, text, serial, integer, numeric, timestamp, unique } from "drizzle-orm/pg-core";
import { consumersTable } from "./consumers";

export const favoritesTable = pgTable(
  "favorites",
  {
    id: serial("id").primaryKey(),
    consumerId: integer("consumer_id").notNull().references(() => consumersTable.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    // Preço no momento em que favoritou — sem isso, "favorito com preço
    // caindo" (#27) não tem como comparar contra nada.
    precoNoFavorito: numeric("preco_no_favorito", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("favorites_consumer_product").on(t.consumerId, t.productId)],
);

export type Favorite = typeof favoritesTable.$inferSelect;
