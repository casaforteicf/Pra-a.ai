import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, consumersTable, passwordResetTokensTable } from "@workspace/db";

declare module "express-session" {
  interface SessionData {
    consumerId?: number;
    cartToken?: string;
  }
}

const router: IRouter = Router();
const RESET_RESPONSE = "Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha.";

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}

async function sendPasswordResetEmail(email: string, name: string, resetUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("RESEND_API_KEY ou EMAIL_FROM não configurado");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(8_000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Redefina sua senha no Praça.ai",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#211c3b"><h1 style="color:#6d4ee8">Praça.ai</h1><p>Olá, ${escapeHtml(name)}.</p><p>Recebemos uma solicitação para redefinir sua senha. Este link é válido por 30 minutos.</p><p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:linear-gradient(135deg,#f7971e,#ffd200);color:#17132f;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:bold">Criar nova senha</a></p><p style="color:#6b7280;font-size:13px">Se você não fez esta solicitação, ignore este e-mail. Sua senha continuará a mesma.</p></div>`,
    }),
  });
  if (!response.ok) throw new Error(`Resend respondeu ${response.status}`);
}

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

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const email = String(req.body?.email || "").toLowerCase().trim();
  if (!email) return void res.status(400).json({ error: "Informe seu e-mail." });

  const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.email, email)).limit(1);
  if (consumer) {
    const token = randomBytes(32).toString("hex");
    await db.update(passwordResetTokensTable).set({ usedAt: new Date() }).where(and(eq(passwordResetTokensTable.consumerId, consumer.id), isNull(passwordResetTokensTable.usedAt)));
    await db.insert(passwordResetTokensTable).values({ consumerId: consumer.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + 30 * 60_000) });
    const baseUrl = (process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    try {
      await sendPasswordResetEmail(consumer.email, consumer.name, `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`);
    } catch (error) {
      req.log.error({ err: error }, "Falha ao enviar e-mail de redefinição de senha");
    }
  }
  res.json({ message: RESET_RESPONSE });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const token = String(req.body?.token || "");
  const password = String(req.body?.password || "");
  if (!token || password.length < 8) return void res.status(400).json({ error: "Use uma senha com pelo menos 8 caracteres." });
  const [reset] = await db.select().from(passwordResetTokensTable).where(and(
    eq(passwordResetTokensTable.tokenHash, hashResetToken(token)),
    isNull(passwordResetTokensTable.usedAt),
    gt(passwordResetTokensTable.expiresAt, new Date()),
  )).limit(1);
  if (!reset) return void res.status(400).json({ error: "Este link é inválido ou expirou. Solicite um novo." });
  const passwordHash = await bcrypt.hash(password, 10);
  await db.transaction(async (tx) => {
    await tx.update(consumersTable).set({ passwordHash }).where(eq(consumersTable.id, reset.consumerId));
    await tx.update(passwordResetTokensTable).set({ usedAt: new Date() }).where(eq(passwordResetTokensTable.id, reset.id));
  });
  res.json({ message: "Senha redefinida. Você já pode entrar." });
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
