import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";

export const deliveryPartnersTable = pgTable("delivery_partners", {
  id: serial("id").primaryKey(),
  praca: text("praca").notNull().default("Chapecó"), // unidade geográfica — hoje só uma praça
  nome: text("nome").notNull(),
  telefone: text("telefone").notNull(),
  veiculoTipo: text("veiculo_tipo").notNull(), // "moto" | "carro" | "bike"
  status: text("status").notNull().default("offline"), // disponivel | em_entrega | offline
  avaliacaoMedia: numeric("avaliacao_media", { precision: 3, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deliveriesTable = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  vendorId: text("vendor_id").notNull(),
  partnerId: integer("partner_id").references(() => deliveryPartnersTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("aguardando"), // aguardando | aceita | coletada | a_caminho | entregue | cancelada
  valorPagoParceiro: numeric("valor_pago_parceiro", { precision: 10, scale: 2 }),
  aceitaEm: timestamp("aceita_em", { withTimezone: true }),
  coletadaEm: timestamp("coletada_em", { withTimezone: true }),
  entregueEm: timestamp("entregue_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DeliveryPartner = typeof deliveryPartnersTable.$inferSelect;
export type Delivery = typeof deliveriesTable.$inferSelect;
