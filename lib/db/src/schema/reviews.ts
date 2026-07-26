import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { consumersTable } from "./consumers";
import { ordersTable } from "./orders";

export const productReviewsTable = pgTable("product_reviews", {
  id: serial("id").primaryKey(),
  productId: text("product_id").notNull(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  consumerId: integer("consumer_id").notNull().references(() => consumersTable.id, { onDelete: "cascade" }),
  nota: integer("nota").notNull(), // 1-5
  comentario: text("comentario"),
  midiaUrls: jsonb("midia_urls").$type<string[]>(),
  moedasGanhas: integer("moedas_ganhas").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProductReview = typeof productReviewsTable.$inferSelect;
