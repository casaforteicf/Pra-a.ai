import { pgTable, varchar, json, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Tabela gerenciada pelo connect-pg-simple (armazenamento de sessão de
 * login), não pelo Drizzle — declarada aqui só pra o drizzle-kit push
 * reconhecer que ela é intencional e parar de propor apagá-la como
 * "tabela órfã fora do schema". Estrutura padrão do connect-pg-simple,
 * não alterar sem checar a lib.
 */
export const sessionTable = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey().notNull(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (table) => ({
    expireIdx: index("IDX_session_expire").on(table.expire),
  }),
);
