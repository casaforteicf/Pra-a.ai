import { pgTable, text, serial, integer, timestamp, numeric, unique } from "drizzle-orm/pg-core";
import { consumersTable } from "./consumers";

export const cartsTable = pgTable("carts", {
  id: serial("id").primaryKey(),
  consumerId: integer("consumer_id").references(() => consumersTable.id, { onDelete: "cascade" }),
  sessionToken: text("session_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const cartItemsTable = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  cartId: integer("cart_id").notNull().references(() => cartsTable.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  productImageUrl: text("product_image_url").notNull(),
  productPrice: numeric("product_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  selectedSize: text("selected_size"),
});

export type Cart = typeof cartsTable.$inferSelect;
export type CartItem = typeof cartItemsTable.$inferSelect;
