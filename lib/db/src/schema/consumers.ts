import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const consumersTable = pgTable("consumers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  cpf: text("cpf"), // capturado no primeiro checkout (obrigatório pra cobrança real); guardado pra não pedir de novo
  passwordHash: text("password_hash").notNull(),
  saldoMoedas: integer("saldo_moedas").notNull().default(0),
  ultimoCheckinEm: text("ultimo_checkin_em"), // data (YYYY-MM-DD) do último check-in, 1x/dia
  dataNascimento: text("data_nascimento"), // YYYY-MM-DD, opcional — pra oportunidade de aniversário
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertConsumerSchema = createInsertSchema(consumersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  saldoMoedas: true,
  ultimoCheckinEm: true,
});
export type InsertConsumer = z.infer<typeof insertConsumerSchema>;
export type Consumer = typeof consumersTable.$inferSelect;
