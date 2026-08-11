import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { consumersTable } from "./consumers";
import { ordersTable } from "./orders";

export const ambassadorsTable = pgTable("ambassadors", {
  id: serial("id").primaryKey(),
  consumerId: integer("consumer_id").notNull().unique().references(() => consumersTable.id, { onDelete: "cascade" }),
  codigo: text("codigo").notNull().unique(),
  nomePublico: text("nome_publico"),
  bio: text("bio"),
  nicho: text("nicho"),
  cidade: text("cidade"),
  instagram: text("instagram"),
  tiktok: text("tiktok"),
  youtube: text("youtube"),
  descontoPercentual: numeric("desconto_percentual", { precision: 5, scale: 2 }).notNull().default("5"),
  comissaoPercentual: numeric("comissao_percentual", { precision: 5, scale: 2 }).notNull().default("5"),
  cliques: integer("cliques").notNull().default(0),
  saldoComissao: numeric("saldo_comissao", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("ativo"), // ativo | bloqueado — superadmin pode bloquear (fraude)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const influencerConversionsTable = pgTable("influencer_conversions", {
  id: serial("id").primaryKey(),
  ambassadorId: integer("ambassador_id").notNull().references(() => ambassadorsTable.id, { onDelete: "cascade" }),
  orderId: integer("order_id").notNull().unique().references(() => ordersTable.id, { onDelete: "cascade" }),
  orderValue: numeric("order_value", { precision: 12, scale: 2 }).notNull(),
  discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull(),
  commissionValue: numeric("commission_value", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pendente"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  ambassadorId: integer("ambassador_id").notNull().references(() => ambassadorsTable.id, { onDelete: "cascade" }),
  indicadoTipo: text("indicado_tipo").notNull(), // "lojista" | "cliente"
  indicadoConsumerId: integer("indicado_consumer_id").references(() => consumersTable.id, { onDelete: "set null" }),
  indicadoTenantId: text("indicado_tenant_id"), // preenchido quando indicadoTipo = "lojista" (id do tenant no Vendor.ai)
  status: text("status").notNull().default("pendente"), // pendente | convertido
  valorComissao: numeric("valor_comissao", { precision: 10, scale: 2 }),
  convertidoEm: timestamp("convertido_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Ambassador = typeof ambassadorsTable.$inferSelect;
export type Referral = typeof referralsTable.$inferSelect;
export type InfluencerConversion = typeof influencerConversionsTable.$inferSelect;

// Valores iniciais de comissão — calibrar depois com uso real.
export const REFERRAL_COMMISSION = {
  LOJISTA_PRIMEIRA_VENDA: 50, // R$ fixo
  CLIENTE_PRIMEIRO_PEDIDO: 5, // R$ fixo
} as const;
