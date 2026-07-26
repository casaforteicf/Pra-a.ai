import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { consumersTable } from "./consumers";

export const ambassadorsTable = pgTable("ambassadors", {
  id: serial("id").primaryKey(),
  consumerId: integer("consumer_id").notNull().unique().references(() => consumersTable.id, { onDelete: "cascade" }),
  codigo: text("codigo").notNull().unique(),
  saldoComissao: numeric("saldo_comissao", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("ativo"), // ativo | bloqueado — superadmin pode bloquear (fraude)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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

// Valores iniciais de comissão — calibrar depois com uso real.
export const REFERRAL_COMMISSION = {
  LOJISTA_PRIMEIRA_VENDA: 50, // R$ fixo
  CLIENTE_PRIMEIRO_PEDIDO: 5, // R$ fixo
} as const;
