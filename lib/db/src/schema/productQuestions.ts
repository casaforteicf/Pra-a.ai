import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { consumersTable } from "./consumers";

export const productQuestionsTable = pgTable("product_questions", {
  id: serial("id").primaryKey(),
  productId: text("product_id").notNull(), // id do produto real (produtos_catalogo, Vendor.ai)
  vendorId: text("vendor_id").notNull(), // tenant_id do lojista — pra rotear a resposta
  consumerId: integer("consumer_id").references(() => consumersTable.id, { onDelete: "set null" }),
  pergunta: text("pergunta").notNull(),
  resposta: text("resposta"),
  // Resposta automática via IA do Vendor.ai ainda não está conectada aqui —
  // depende do Agent (bloqueado por cota no momento desta implementação).
  // Por enquanto, pergunta fica pendente até alguém responder manualmente
  // (via endpoint PATCH) ou até essa integração ser construída.
  respondidoEm: timestamp("respondido_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProductQuestion = typeof productQuestionsTable.$inferSelect;
