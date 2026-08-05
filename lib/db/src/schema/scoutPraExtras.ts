import { pgTable, text, serial, integer, numeric, timestamp, boolean } from "drizzle-orm/pg-core";
import { consumersTable } from "./consumers";

// Navegação intensa (#25) e conteúdo de aquecimento (#55-58) — log leve
// de visualização de produto. Sem índice pesado, é escrita simples;
// consultas agregam por consumidor+produto numa janela de dias.
export const productViewsTable = pgTable("product_views", {
  id: serial("id").primaryKey(),
  consumerId: integer("consumer_id").references(() => consumersTable.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Busca sem resultado (#26) — só grava quando teveResultado=false, pra
// não virar log de toda busca do site (volume desnecessário).
export const searchLogsTable = pgTable("search_logs", {
  id: serial("id").primaryKey(),
  consumerId: integer("consumer_id").references(() => consumersTable.id, { onDelete: "cascade" }),
  termo: text("termo").notNull(),
  teveResultado: boolean("teve_resultado").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Cupom atribuído a um consumidor específico, com validade própria —
// diferente de COUPONS (constante fixa no código, sem dono). Cupom
// expirando (#31) só existe com isso.
export const consumerCouponsTable = pgTable("consumer_coupons", {
  id: serial("id").primaryKey(),
  consumerId: integer("consumer_id").notNull().references(() => consumersTable.id, { onDelete: "cascade" }),
  codigo: text("codigo").notNull(),
  valorDesconto: numeric("valor_desconto", { precision: 10, scale: 2 }),
  percentualDesconto: numeric("percentual_desconto", { precision: 5, scale: 2 }),
  expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
  usadoEm: timestamp("usado_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Campanha com prazo (frete grátis por tempo limitado, promoção
// relâmpago #29-30) — entidade que hoje não existe (preço é sempre
// fixo por produto).
export const campanhasTable = pgTable("campanhas", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  tipo: text("tipo").notNull(), // "frete_gratis" | "desconto_percentual" | "desconto_valor"
  valor: numeric("valor", { precision: 10, scale: 2 }), // percentual ou valor, conforme o tipo
  categoriaAlvo: text("categoria_alvo"), // null = todo o catálogo
  inicioEm: timestamp("inicio_em", { withTimezone: true }).notNull(),
  fimEm: timestamp("fim_em", { withTimezone: true }).notNull(),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Benefício de fidelidade por nível — hoje só existe saldo de moedas,
// sem tier/benefício associado (#40).
export const consumerBeneficiosTable = pgTable("consumer_beneficios", {
  id: serial("id").primaryKey(),
  consumerId: integer("consumer_id").notNull().references(() => consumersTable.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(), // "frete_gratis_premium" | "desconto_fixo" | etc — livre, calibrar com uso real
  descricao: text("descricao").notNull(),
  usadoEm: timestamp("usado_em", { withTimezone: true }),
  expiraEm: timestamp("expira_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Assinatura/reposição automática (#38, #41) — recorrência de um
// produto específico pro consumidor, sem isso não existe "ativar
// entrega automática".
export const assinaturasTable = pgTable("assinaturas", {
  id: serial("id").primaryKey(),
  consumerId: integer("consumer_id").notNull().references(() => consumersTable.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  frequenciaDias: integer("frequencia_dias").notNull(),
  status: text("status").notNull().default("ativa"), // "ativa" | "pausada" | "cancelada"
  proximaEntregaEm: timestamp("proxima_entrega_em", { withTimezone: true }),
  canceladaEm: timestamp("cancelada_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Resposta de NPS (#54) — não existia nenhuma pesquisa de satisfação
// estruturada.
export const npsRespostasTable = pgTable("nps_respostas", {
  id: serial("id").primaryKey(),
  consumerId: integer("consumer_id").notNull().references(() => consumersTable.id, { onDelete: "cascade" }),
  orderId: integer("order_id"),
  nota: integer("nota").notNull(), // 0-10
  comentario: text("comentario"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProductView = typeof productViewsTable.$inferSelect;
export type SearchLog = typeof searchLogsTable.$inferSelect;
export type ConsumerCoupon = typeof consumerCouponsTable.$inferSelect;
export type Campanha = typeof campanhasTable.$inferSelect;
export type ConsumerBeneficio = typeof consumerBeneficiosTable.$inferSelect;
export type Assinatura = typeof assinaturasTable.$inferSelect;
export type NpsResposta = typeof npsRespostasTable.$inferSelect;
