import { Router, type IRouter } from "express";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db, productQuestionsTable } from "@workspace/db";
import { getProductById } from "../lib/catalogService";

const router: IRouter = Router();

router.get("/products/:id/perguntas", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  // Só perguntas já respondidas ficam públicas — as pendentes ficam numa
  // fila interna do vendedor (não implementada como tela ainda, mas o dado
  // já existe e é filtrável).
  const perguntas = await db
    .select()
    .from(productQuestionsTable)
    .where(and(eq(productQuestionsTable.productId, id), isNotNull(productQuestionsTable.resposta)))
    .orderBy(desc(productQuestionsTable.respondidoEm));

  res.json(perguntas);
});

router.post("/products/:id/perguntas", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { pergunta } = req.body as { pergunta?: string };

  if (!pergunta || pergunta.trim().length === 0) {
    res.status(400).json({ error: "Escreva sua pergunta." });
    return;
  }

  const consumerId = req.session?.consumerId;
  if (!consumerId) {
    res.status(401).json({ error: "Faça login para perguntar sobre o produto." });
    return;
  }

  const product = await getProductById(id);
  if (!product) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }

  const [question] = await db
    .insert(productQuestionsTable)
    .values({
      productId: id,
      vendorId: product.vendorId,
      consumerId,
      pergunta: pergunta.trim(),
    })
    .returning();

  res.status(201).json(question);
});

// Uso interno/lojista — sem tela própria ainda (a resposta automática via
// agente de IA do Vendor.ai depende do Agent estar disponível; até lá, esse
// endpoint permite responder manualmente).
router.patch("/perguntas/:id/responder", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const questionId = parseInt(id, 10);
  const { resposta } = req.body as { resposta?: string };

  if (isNaN(questionId) || !resposta) {
    res.status(400).json({ error: "Informe a resposta." });
    return;
  }

  const [updated] = await db
    .update(productQuestionsTable)
    .set({ resposta, respondidoEm: new Date() })
    .where(eq(productQuestionsTable.id, questionId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Pergunta não encontrada" });
    return;
  }

  res.json(updated);
});

export default router;
