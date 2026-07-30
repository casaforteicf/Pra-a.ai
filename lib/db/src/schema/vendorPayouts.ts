import { pgTable, text, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";

/**
 * Razão de repasses pro lojista — não é split automático via Asaas (isso
 * exigiria subconta própria por lojista, com KYC/CPF-CNPJ/dados bancários,
 * ainda não construído). Por enquanto: calcula quanto cada lojista tem a
 * receber de cada venda (já descontando a comissão da plataforma), e o
 * repasse de verdade acontece manualmente por fora (PIX/transferência).
 * Essa tabela só registra o cálculo e o status (pendente/pago).
 */
export const vendorPayoutsTable = pgTable("vendor_payouts", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  vendorId: text("vendor_id").notNull(), // tenant_id do Vendor.ai
  valorBruto: numeric("valor_bruto", { precision: 12, scale: 2 }).notNull(), // soma dos itens desse vendedor no pedido
  comissaoPercentual: numeric("comissao_percentual", { precision: 5, scale: 2 }).notNull(), // % vigente no momento da venda (histórico, não recalcula se mudar depois)
  comissaoValor: numeric("comissao_valor", { precision: 12, scale: 2 }).notNull(),
  valorLiquido: numeric("valor_liquido", { precision: 12, scale: 2 }).notNull(), // o que o lojista tem a receber
  status: text("status").notNull().default("pendente"), // pendente | pago
  pagoEm: timestamp("pago_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type VendorPayout = typeof vendorPayoutsTable.$inferSelect;
