import { pgTable, uuid, text, varchar, integer, numeric, date, timestamp, bigserial, boolean, unique, index } from "drizzle-orm/pg-core";
import { consumersTable } from "./consumers";

export const buyingRoundsTable = pgTable("buying_rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  category: varchar("category", { length: 120 }).notNull(),
  itemName: varchar("item_name", { length: 200 }).notNull(),
  specification: text("specification"),
  unit: varchar("unit", { length: 30 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  neededAt: date("needed_at").notNull(),
  closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
  createdByConsumerId: integer("created_by_consumer_id").references(() => consumersTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("open"),
  winningBidId: uuid("winning_bid_id"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_buying_rounds_open_location").on(table.city, table.state, table.closesAt),
]);

export const buyingRoundParticipantsTable = pgTable("buying_round_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id").notNull().references(() => buyingRoundsTable.id, { onDelete: "cascade" }),
  consumerId: integer("consumer_id").notNull().references(() => consumersTable.id, { onDelete: "cascade" }),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("buying_round_participant_unique").on(table.roundId, table.consumerId),
  index("idx_buying_round_participants_consumer").on(table.consumerId, table.joinedAt),
]);

export const buyingRoundBidsTable = pgTable("buying_round_bids", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id").notNull().references(() => buyingRoundsTable.id, { onDelete: "cascade" }),
  vendorId: text("vendor_id").notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  freightTotal: numeric("freight_total", { precision: 14, scale: 2 }).notNull().default("0"),
  deliveryDays: integer("delivery_days").notNull(),
  terms: text("terms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique("buying_round_bid_unique").on(table.roundId, table.vendorId)]);

export const buyingRoundBidEventsTable = pgTable("buying_round_bid_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  bidId: uuid("bid_id").notNull().references(() => buyingRoundBidsTable.id, { onDelete: "cascade" }),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  freightTotal: numeric("freight_total", { precision: 14, scale: 2 }).notNull(),
  deliveryDays: integer("delivery_days").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const buyingRoundOrdersTable = pgTable("buying_round_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id").notNull().references(() => buyingRoundsTable.id, { onDelete: "cascade" }),
  participantId: uuid("participant_id").notNull().unique().references(() => buyingRoundParticipantsTable.id, { onDelete: "cascade" }),
  bidId: uuid("bid_id").notNull().references(() => buyingRoundBidsTable.id),
  vendorId: text("vendor_id").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  status: text("status").notNull().default("awaiting_buyer"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  paymentMethod: text("payment_method"),
  asaasChargeId: text("asaas_charge_id").unique(),
  asaasPixPayload: text("asaas_pix_payload"),
  asaasPixQrcodeImage: text("asaas_pix_qrcode_image"),
  asaasInvoiceUrl: text("asaas_invoice_url"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  crmSyncStatus: text("crm_sync_status"),
  crmLeadId: text("crm_lead_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("idx_buying_round_orders_status").on(table.status, table.createdAt)]);

export const buyingRoundVendorLeadsTable = pgTable("buying_round_vendor_leads", {
  roundId: uuid("round_id").notNull().references(() => buyingRoundsTable.id, { onDelete: "cascade" }),
  vendorId: text("vendor_id").notNull(),
  crmLeadId: text("crm_lead_id").notNull(),
  crmNotified: boolean("crm_notified").notNull().default(false),
  identityRevealedAt: timestamp("identity_revealed_at", { withTimezone: true }),
}, (table) => [unique("buying_round_vendor_leads_round_vendor_unique").on(table.roundId, table.vendorId)]);

export type BuyingRound = typeof buyingRoundsTable.$inferSelect;
export type BuyingRoundOrder = typeof buyingRoundOrdersTable.$inferSelect;
