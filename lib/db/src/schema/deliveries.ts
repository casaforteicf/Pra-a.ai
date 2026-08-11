import { pgTable, text, serial, integer, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";
import { consumersTable } from "./consumers";

export const deliveryPartnersTable = pgTable("delivery_partners", {
  id: serial("id").primaryKey(),
  consumerId: integer("consumer_id").unique().references(() => consumersTable.id, { onDelete: "set null" }),
  praca: text("praca").notNull().default("Chapecó"),
  nome: text("nome").notNull(),
  telefone: text("telefone").notNull(),
  cpf: text("cpf"),
  documentoFotoUrl: text("documento_foto_url"),
  selfieUrl: text("selfie_url"),
  cnhUrl: text("cnh_url"),
  veiculoDocumentoUrl: text("veiculo_documento_url"),
  veiculoTipo: text("veiculo_tipo").notNull(),
  placa: text("placa"),
  documentacaoStatus: text("documentacao_status").notNull().default("pendente"),
  status: text("status").notNull().default("offline"),
  avaliacaoMedia: numeric("avaliacao_media", { precision: 3, scale: 2 }),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  localizacaoEm: timestamp("localizacao_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deliveriesTable = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  vendorId: text("vendor_id").notNull(),
  partnerId: integer("partner_id").references(() => deliveryPartnersTable.id, { onDelete: "set null" }),
  supportPointId: integer("support_point_id"),
  origem: text("origem").notNull().default("produto"),
  status: text("status").notNull().default("preparando"),
  larguraCm: numeric("largura_cm", { precision: 10, scale: 2 }),
  alturaCm: numeric("altura_cm", { precision: 10, scale: 2 }),
  profundidadeCm: numeric("profundidade_cm", { precision: 10, scale: 2 }),
  pesoKg: numeric("peso_kg", { precision: 10, scale: 3 }),
  volumeFotoUrl: text("volume_foto_url"),
  valorPagoParceiro: numeric("valor_pago_parceiro", { precision: 10, scale: 2 }),
  ofertaExpiraEm: timestamp("oferta_expira_em", { withTimezone: true }),
  aceitaEm: timestamp("aceita_em", { withTimezone: true }),
  coletadaEm: timestamp("coletada_em", { withTimezone: true }),
  entregueEm: timestamp("entregue_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deliveryEventsTable = pgTable("delivery_events", {
  id: serial("id").primaryKey(),
  deliveryId: integer("delivery_id").notNull().references(() => deliveriesTable.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  observacao: text("observacao"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deliveryProofsTable = pgTable("delivery_proofs", {
  id: serial("id").primaryKey(),
  deliveryId: integer("delivery_id").notNull().references(() => deliveriesTable.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(),
  arquivoUrl: text("arquivo_url").notNull(),
  recebedorNome: text("recebedor_nome"),
  consentimentoPessoa: boolean("consentimento_pessoa").notNull().default(false),
  observacao: text("observacao"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pracaBankTransactionsTable = pgTable("praca_bank_transactions", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => deliveryPartnersTable.id, { onDelete: "cascade" }),
  deliveryId: integer("delivery_id").references(() => deliveriesTable.id, { onDelete: "set null" }),
  tipo: text("tipo").notNull().default("credito_entrega"),
  valor: numeric("valor", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pendente"),
  descricao: text("descricao").notNull(),
  disponivelEm: timestamp("disponivel_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportPointsTable = pgTable("support_points", {
  id: serial("id").primaryKey(),
  praca: text("praca").notNull().default("Chapecó"),
  nome: text("nome").notNull(),
  endereco: text("endereco").notNull(),
  tipo: text("tipo").notNull().default("loja_parceira"),
  ativo: text("ativo").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SupportPoint = typeof supportPointsTable.$inferSelect;
export type DeliveryPartner = typeof deliveryPartnersTable.$inferSelect;
export type Delivery = typeof deliveriesTable.$inferSelect;
