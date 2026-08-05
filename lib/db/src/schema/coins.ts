import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { consumersTable } from "./consumers";

export const coinTransactionsTable = pgTable("coin_transactions", {
  id: serial("id").primaryKey(),
  consumerId: integer("consumer_id").notNull().references(() => consumersTable.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(), // "ganho" | "resgate"
  quantidade: integer("quantidade").notNull(),
  motivo: text("motivo").notNull(), // "checkin" | "compra" | "avaliacao" | "avaliacao_com_midia" | "resgate_cupom"
  // Validade — só preenchido em transações de "ganho". Sem isso não dá
  // pra avisar "seus pontos vão expirar" (#39), moeda seria saldo eterno.
  expiraEm: timestamp("expira_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CoinTransaction = typeof coinTransactionsTable.$inferSelect;

// Regras de ganho — valores iniciais, calibrar depois com uso real.
export const COIN_RULES = {
  CHECKIN_DIARIO: 5,
  AVALIACAO_SEM_MIDIA: 10,
  AVALIACAO_COM_MIDIA: 25,
  COMPRA_A_CADA_R10: 1,
} as const;
