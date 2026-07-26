import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, consumersTable } from "@workspace/db";
import { findOrCreateLead, sendChatMessage, getChatMessages } from "../lib/vendorSyncService";

const router: IRouter = Router();

router.get("/chat/:vendorId/mensagens", async (req, res): Promise<void> => {
  const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.status(401).json({ error: "Faça login para conversar com o vendedor." });
    return;
  }

  try {
    const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.id, consumerId)).limit(1);
    if (!consumer) {
      res.status(404).json({ error: "Consumidor não encontrado" });
      return;
    }

    const leadId = await findOrCreateLead(vendorId, {
      nome: consumer.name,
      telefone: consumer.phone ?? null,
      email: consumer.email,
    });

    const mensagens = await getChatMessages(vendorId, leadId);
    res.json(mensagens);
  } catch (err) {
    console.error("[chat] erro ao carregar mensagens:", err);
    res.status(500).json({ error: "Não foi possível carregar a conversa agora." });
  }
});

router.post("/chat/:vendorId/mensagens", async (req, res): Promise<void> => {
  const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.status(401).json({ error: "Faça login para conversar com o vendedor." });
    return;
  }

  const { conteudo } = req.body as { conteudo?: string };
  if (!conteudo || conteudo.trim().length === 0) {
    res.status(400).json({ error: "Escreva uma mensagem." });
    return;
  }

  try {
    const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.id, consumerId)).limit(1);
    if (!consumer) {
      res.status(404).json({ error: "Consumidor não encontrado" });
      return;
    }

    const leadId = await findOrCreateLead(vendorId, {
      nome: consumer.name,
      telefone: consumer.phone ?? null,
      email: consumer.email,
    });

    const message = await sendChatMessage({ tenantId: vendorId, leadId, conteudo: conteudo.trim() });
    res.status(201).json(message);
  } catch (err) {
    console.error("[chat] erro ao enviar mensagem:", err);
    res.status(500).json({ error: "Não foi possível enviar a mensagem agora." });
  }
});

export default router;
