import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";
import { consumersTable } from "./consumers";

export const disputesTable = pgTable("disputes", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  consumerId: integer("consumer_id").references(() => consumersTable.id, { onDelete: "set null" }),
  motivo: text("motivo").notNull(), // "arrependimento" | "defeito" | "produto_errado" | "outro"
  descricao: text("descricao").notNull(),
  evidenciaUrl: text("evidencia_url"),
  status: text("status").notNull().default("aberta"), // aberta | em_analise | resolvida
  // Regra decidida: custo do frete de devolução nunca fica com o cliente.
  // Caso padrão (arrependimento): rateado entre vendedor e entregador.
  // Erro do lojista: retorna integralmente pro lojista.
  freteDevolucaoResponsavel: text("frete_devolucao_responsavel"), // "rateado" | "lojista"
  freteDevolucaoValorVendedor: numeric("frete_devolucao_valor_vendedor", { precision: 10, scale: 2 }),
  freteDevolucaoValorEntregador: numeric("frete_devolucao_valor_entregador", { precision: 10, scale: 2 }),
  resolucaoTexto: text("resolucao_texto"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvidoEm: timestamp("resolvido_em", { withTimezone: true }),
});

export type Dispute = typeof disputesTable.$inferSelect;
