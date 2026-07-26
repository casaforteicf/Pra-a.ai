import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, consumersTable } from "@workspace/db";

declare module "express-session" {
  interface SessionData {
    consumerId?: number;
    cartToken?: string;
  }
}

const router: IRouter = Router();

// POST /auth/register
router.post("/auth/register", async (req, res): Promise<void> => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
    return;
  }

  const existing = await db
    .select({ id: consumersTable.id })
    .from(consumersTable)
    .where(eq(consumersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Já existe uma conta com este e-mail." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [consumer] = await db
    .insert(consumersTable)
    .values({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() ?? null,
      passwordHash,
    })
    .returning();

  req.session.consumerId = consumer.id;
  req.session.save((err) => {
    if (err) {
      req.log.error({ err }, "Failed to save session");
      res.status(500).json({ error: "Erro ao criar sessão." });
      return;
    }
    res.status(201).json({
      id: consumer.id,
      name: consumer.name,
      email: consumer.email,
      phone: consumer.phone,
      createdAt: consumer.createdAt,
    });
  });
});

// POST /auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    return;
  }

  const [consumer] = await db
    .select()
    .from(consumersTable)
    .where(eq(consumersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!consumer) {
    res.status(401).json({ error: "E-mail ou senha incorretos." });
    return;
  }

  const valid = await bcrypt.compare(password, consumer.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "E-mail ou senha incorretos." });
    return;
  }

  req.session.consumerId = consumer.id;
  req.session.save((err) => {
    if (err) {
      req.log.error({ err }, "Failed to save session");
      res.status(500).json({ error: "Erro ao criar sessão." });
      return;
    }
    res.json({
      id: consumer.id,
      name: consumer.name,
      email: consumer.email,
      phone: consumer.phone,
      createdAt: consumer.createdAt,
    });
  });
});

// POST /auth/logout
router.post("/auth/logout", (req, res): void => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Failed to destroy session");
    }
    res.clearCookie("connect.sid");
    res.json({ error: "Logged out" });
  });
});

// GET /auth/me
router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.consumerId) {
    res.status(401).json({ error: "Não autenticado." });
    return;
  }

  const [consumer] = await db
    .select()
    .from(consumersTable)
    .where(eq(consumersTable.id, req.session.consumerId))
    .limit(1);

  if (!consumer) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Sessão inválida." });
    return;
  }

  res.json({
    id: consumer.id,
    name: consumer.name,
    email: consumer.email,
    phone: consumer.phone,
    createdAt: consumer.createdAt,
  });
});

export default router;
