import { Router, type IRouter } from "express";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db, productQuestionsTable } from "@workspace/db";
import { getProductById } from "../lib/catalogService";

const router: IRouter = Router();

const VENDOR_API_BASE_URL = process.env.VENDOR_API_BASE_URL || "https://appvendorai.com/api";

/**
 * Chama o endpoint de IA do Vendor.ai pra responder automaticamente. Se
 * falhar por qualquer motivo (Vendor.ai fora do ar, sem chave configurada,
 * timeout), a pergunta fica pendente — alguém responde manualmente depois
 * via PATCH /perguntas/:id/responder. Nunca deixa a criação da pergunta
 * falhar por causa disso.
 */
async function tentarResponderViaIA(vendorId: string, productId: string, pergunta: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(`${VENDOR_API_BASE_URL}/produtos-catalogo/${productId}/responder-pergunta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pergunta }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = (await response.json()) as { resposta?: unknown };
    return typeof data.resposta === "string" ? data.resposta : null;
  } catch (err) {
    console.error("[productQuestions] falha ao chamar IA do Vendor.ai (pergunta fica pendente):", err);
    return null;
  }
}

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

  const respostaIA = await tentarResponderViaIA(product.vendorId, id, pergunta.trim());

  const [question] = await db
    .insert(productQuestionsTable)
    .values({
      productId: id,
      vendorId: product.vendorId,
      consumerId,
      pergunta: pergunta.trim(),
      resposta: respostaIA,
      respondidoEm: respostaIA ? new Date() : null,
    })
    .returning();

  res.status(201).json(question);
});

// Lista de perguntas pendentes de um vendedor — usada pelo Vendor.ai (área
// do lojista) pra mostrar a fila de perguntas sem resposta ainda.
router.get("/tenants/:tenantId/perguntas-pendentes", async (req, res): Promise<void> => {
  const tenantId = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;

  const perguntas = await db
    .select()
    .from(productQuestionsTable)
    .where(and(eq(productQuestionsTable.vendorId, tenantId), isNull(productQuestionsTable.resposta)))
    .orderBy(desc(productQuestionsTable.createdAt));

  res.json(perguntas);
});

// Fallback manual — usado quando a resposta automática via IA (acima) falha
// ou não está disponível (Vendor.ai fora do ar, etc.). Chamado pelo
// Vendor.ai server-to-server — exige vendorId no corpo batendo com o dono
// real da pergunta, pra um tenant não conseguir responder pergunta de outro.
router.patch("/perguntas/:id/responder", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const questionId = parseInt(id, 10);
  const { resposta, vendorId } = req.body as { resposta?: string; vendorId?: string };

  if (isNaN(questionId) || !resposta || !vendorId) {
    res.status(400).json({ error: "Informe a resposta e o vendorId." });
    return;
  }

  const [question] = await db.select().from(productQuestionsTable).where(eq(productQuestionsTable.id, questionId));
  if (!question) {
    res.status(404).json({ error: "Pergunta não encontrada" });
    return;
  }
  if (question.vendorId !== vendorId) {
    res.status(403).json({ error: "Essa pergunta não pertence a esse vendedor." });
    return;
  }

  const [updated] = await db
    .update(productQuestionsTable)
    .set({ resposta, respondidoEm: new Date() })
    .where(eq(productQuestionsTable.id, questionId))
    .returning();

  res.json(updated);
});

export default router;
