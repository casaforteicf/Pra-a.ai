import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { consumersTable } from "./consumers";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  consumerId: integer("consumer_id").references(() => consumersTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("confirmed"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  shipping: numeric("shipping", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  deliveryAddress: text("delivery_address").notNull(), // JSON string
  deliveryOption: text("delivery_option").notNull(),
  couponCode: text("coupon_code"),
  estimatedDelivery: text("estimated_delivery"),
  trackingCode: text("tracking_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  productImageUrl: text("product_image_url").notNull(),
  quantity: integer("quantity").notNull(),
  priceAtPurchase: numeric("price_at_purchase", { precision: 10, scale: 2 }).notNull(),
  selectedSize: text("selected_size"),
});

export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
