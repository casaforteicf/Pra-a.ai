import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, desc } from "drizzle-orm";
import { db, scoutPraRegrasTable, scoutPraOportunidadesTable } from "@workspace/db";
import { runScoutPraTodasRegras } from "../lib/revenueScoutBuyer";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Mesma trava simples de chave compartilhada já usada em admin.ts —
// consistente com o resto do painel de admin do Praça.ai hoje.
function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const configuredKey = process.env.PRACA_ADMIN_API_KEY;
  if (!configuredKey) {
    res.status(503).json({ error: "Admin API não configurada (PRACA_ADMIN_API_KEY ausente)." });
    return;
  }
  const providedKey = req.header("x-admin-key");
  if (providedKey !== configuredKey) {
    res.status(401).json({ error: "Chave de admin inválida ou ausente." });
    return;
  }
  next();
}

router.use("/admin/scout", requireAdminKey);

router.get("/admin/scout/regras", async (_req, res) => {
  const regras = await db.select().from(scoutPraRegrasTable).orderBy(desc(scoutPraRegrasTable.createdAt));
  res.json(regras);
});

router.post("/admin/scout/regras", async (req, res) => {
  const { nome, tipo, condicoes, canal, mensagemTemplate, pesoEstrategico } = req.body;
  if (!nome || !tipo || !mensagemTemplate) {
    res.status(422).json({ error: "nome, tipo e mensagemTemplate são obrigatórios" });
    return;
  }
  const [regra] = await db.insert(scoutPraRegrasTable).values({
    nome,
    tipo,
    condicoes: condicoes ?? {},
    canal: canal ?? "push",
    mensagemTemplate,
    pesoEstrategico: pesoEstrategico != null ? String(pesoEstrategico) : undefined,
  }).returning();
  res.status(201).json(regra);
});

router.patch("/admin/scout/regras/:id", async (req, res) => {
  const [regra] = await db.update(scoutPraRegrasTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(scoutPraRegrasTable.id, req.params.id as string))
    .returning();
  if (!regra) {
    res.status(404).json({ error: "Regra não encontrada" });
    return;
  }
  res.json(regra);
});

router.get("/admin/scout/oportunidades", async (req, res) => {
  const status = req.query["status"] as string | undefined;
  const query = db.select().from(scoutPraOportunidadesTable).orderBy(desc(scoutPraOportunidadesTable.createdAt)).limit(200);
  const oportunidades = status
    ? await db.select().from(scoutPraOportunidadesTable).where(eq(scoutPraOportunidadesTable.status, status as any)).orderBy(desc(scoutPraOportunidadesTable.createdAt)).limit(200)
    : await query;
  res.json(oportunidades);
});

// Dispara o motor manualmente — em produção isso deveria ser um cron
// (Railway cron job ou similar), não implementado aqui ainda (ver README).
router.post("/admin/scout/rodar", async (_req, res) => {
  try {
    const resultado = await runScoutPraTodasRegras(logger);
    res.json({ ok: true, resultado });
  } catch (err) {
    logger.error({ err }, "scout-pra: falha ao rodar manualmente");
    res.status(500).json({ error: "Falha ao rodar o motor" });
  }
});

export default router;
