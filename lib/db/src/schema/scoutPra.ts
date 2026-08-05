import { pgTable, text, timestamp, integer, jsonb, boolean, numeric } from "drizzle-orm/pg-core";
import { consumersTable } from "./consumers";

// Revenue Scout — Lado Comprador (Praça.ai). Espelha o conceito do
// Revenue Scout do Vendor.ai (scout_regras/scout_oportunidades), mas
// pra consumidor final do marketplace, não pra lead B2B de um tenant.
//
// 25 mecanismos cobrem as 68 situações do documento — a maioria das 68
// é o MESMO mecanismo com produto/categoria diferente (ex: "fralda
// acabando" e "ração acabando" são os dois recompra_programada,
// diferindo só na categoria configurada), não código separado por
// situação.
export const scoutPraTipoValues = [
  // Funcionam HOJE, sem histórico de compra — disparam em cima de
  // evento em tempo real (carrinho, navegação, catálogo).
  "carrinho_abandonado",
  "navegacao_intensa",
  "favorito_preco_caiu",
  "estoque_baixo",
  "cupom_expirando",
  "busca_sem_resultado",
  "promocao_relampago",
  // Precisam de histórico de compra acumulado — hoje simplesmente não
  // encontram ninguém ainda (Chapecó começando), mas o mecanismo já
  // funciona, pronto pra quando existir pedido de verdade.
  "recompra_programada",
  "cross_sell",
  "upsell",
  "sazonalidade_evento",
  "adesao_assinatura",
  "pontos_expirando",
  "beneficio_nao_usado",
  "credito_pre_aprovado",
  "seguro_produto",
  "reativacao_inativo",
  "aniversario",
  "milestone_compras",
  "nps_baixo",
  "conteudo_aquecimento",
  "pos_compra_avaliacao",
  "produto_nova_versao",
  "auto_presente",
  "gatilho_externo",
  "assinatura_cancelada",
] as const;
export type ScoutPraTipo = (typeof scoutPraTipoValues)[number];

export const scoutPraRegrasTable = pgTable("scout_pra_regras", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  nome: text("nome").notNull(),
  tipo: text("tipo").notNull().$type<ScoutPraTipo>(),
  // Condições livres (jsonb) — o que varia por mecanismo: categoria de
  // produto, ciclo em dias, percentual de desconto do gatilho, etc.
  // Mesma filosofia do scout_regras.condicoes do Vendor.ai.
  condicoes: jsonb("condicoes").$type<Record<string, unknown>>().notNull().default({}),
  canal: text("canal").notNull().$type<"push" | "sms" | "email" | "app">().default("push"),
  mensagemTemplate: text("mensagem_template").notNull(),
  pesoEstrategico: numeric("peso_estrategico", { precision: 4, scale: 2 }).notNull().default("1.0"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const scoutPraOportunidadesTable = pgTable("scout_pra_oportunidades", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  regraId: text("regra_id").notNull().references(() => scoutPraRegrasTable.id, { onDelete: "cascade" }),
  consumerId: integer("consumer_id").notNull().references(() => consumersTable.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull().$type<ScoutPraTipo>(),
  descricao: text("descricao").notNull(),
  mensagem: text("mensagem").notNull(),
  canal: text("canal").notNull(),
  // produto/categoria que motivou (se aplicável) — pra o link da
  // mensagem apontar pro lugar certo.
  produtoId: text("produto_id"),
  // Status do CICLO DE VIDA DA OPORTUNIDADE, não do envio em si —
  // "enviado" só quer dizer que passou a fase de decisão, o disparo de
  // verdade (push/SMS/e-mail) é responsabilidade de outra peça (ver
  // README, hoje esse canal não existe ainda no Praça.ai).
  status: text("status").notNull().default("pendente").$type<"pendente" | "enviado" | "convertido" | "ignorado" | "expirado">(),
  scoreOportunidade: numeric("score_oportunidade", { precision: 6, scale: 2 }).notNull(),
  receitaEsperada: numeric("receita_esperada", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Governança de frequência (seção 5 do documento) — quantas mensagens
// cada consumidor já recebeu, por canal, pra respeitar os limites
// (push 1/dia, SMS 2/semana, e-mail 2/semana) e suprimir se já
// converteu no dia.
export const scoutPraEnviosLogTable = pgTable("scout_pra_envios_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  consumerId: integer("consumer_id").notNull().references(() => consumersTable.id, { onDelete: "cascade" }),
  oportunidadeId: text("oportunidade_id").references(() => scoutPraOportunidadesTable.id, { onDelete: "set null" }),
  canal: text("canal").notNull(),
  enviadoEm: timestamp("enviado_em", { withTimezone: true }).notNull().defaultNow(),
});

export type ScoutPraRegra = typeof scoutPraRegrasTable.$inferSelect;
export type ScoutPraOportunidade = typeof scoutPraOportunidadesTable.$inferSelect;
