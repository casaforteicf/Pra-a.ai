import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { consumersTable } from "./consumers";

export const passwordResetTokensTable = pgTable("praca_password_reset_tokens", {
  id: serial("id").primaryKey(),
  consumerId: integer("consumer_id").notNull().references(() => consumersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
