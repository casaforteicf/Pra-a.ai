import crypto from "crypto";
import { vendorPool } from "./vendorDb";

interface ConsumerInfo {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
}

/**
 * Busca um lead existente do consumidor nesse tenant (por telefone ou e-mail),
 * ou cria um novo. Evita duplicar lead a cada novo pedido do mesmo cliente
 * pro mesmo lojista.
 */
export async function findOrCreateLead(tenantId: string, consumer: ConsumerInfo): Promise<string> {
  if (consumer.telefone) {
    const existing = await vendorPool.query(
      `SELECT id FROM leads WHERE tenant_id = $1 AND telefone = $2 LIMIT 1`,
      [tenantId, consumer.telefone],
    );
    if (existing.rows.length > 0) return existing.rows[0].id;
  }

  if (consumer.email) {
    const existing = await vendorPool.query(
      `SELECT id FROM leads WHERE tenant_id = $1 AND email = $2 LIMIT 1`,
      [tenantId, consumer.email],
    );
    if (existing.rows.length > 0) return existing.rows[0].id;
  }

  const leadId = crypto.randomUUID();
  await vendorPool.query(
    `INSERT INTO leads (id, tenant_id, nome, telefone, email, endereco, source, status, tipo)
     VALUES ($1, $2, $3, $4, $5, $6, 'praca_ai', 'novo', 'cliente')`,
    [leadId, tenantId, consumer.nome, consumer.telefone ?? null, consumer.email ?? null, consumer.endereco ?? null],
  );
  return leadId;
}

interface ChatMessage {
  id: string;
  conteudo: string;
  enviadoPor: string; // 'lead' | 'agente_ia' | 'humano'
  direcao: string; // 'entrada' | 'saida'
  createdAt: string;
}

/**
 * Encontra (ou cria) a conversa do Praça.ai desse lead com esse tenant.
 * Reaproveita as tabelas conversations/messages já usadas pelo Vendor.ai —
 * a mensagem cai direto na mesma inbox que o lojista já usa (Conversas),
 * marcada com channel = 'praca_ai', em vez de criar uma inbox nova e solta.
 */
async function findOrCreateConversation(tenantId: string, leadId: string): Promise<string> {
  const existing = await vendorPool.query(
    `SELECT id FROM conversations WHERE tenant_id = $1 AND lead_id = $2 AND channel = 'praca_ai' LIMIT 1`,
    [tenantId, leadId],
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const conversationId = crypto.randomUUID();
  await vendorPool.query(
    `INSERT INTO conversations (id, tenant_id, lead_id, channel, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'praca_ai', 'open', now(), now())`,
    [conversationId, tenantId, leadId],
  );
  return conversationId;
}

export async function sendChatMessage(params: {
  tenantId: string;
  leadId: string;
  conteudo: string;
}): Promise<ChatMessage> {
  const conversationId = await findOrCreateConversation(params.tenantId, params.leadId);
  const messageId = crypto.randomUUID();

  await vendorPool.query(
    `INSERT INTO messages (id, tenant_id, conversation_id, lead_id, direcao, canal, conteudo, tipo_conteudo, enviado_por, status, created_at)
     VALUES ($1, $2, $3, $4, 'entrada', 'chat', $5, 'texto', 'lead', 'enviado', now())`,
    [messageId, params.tenantId, conversationId, params.leadId, params.conteudo],
  );

  await vendorPool.query(
    `UPDATE conversations SET ultima_mensagem_em = now(), updated_at = now(), nao_lidas = nao_lidas + 1 WHERE id = $1`,
    [conversationId],
  );

  return { id: messageId, conteudo: params.conteudo, enviadoPor: "lead", direcao: "entrada", createdAt: new Date().toISOString() };
}

export async function getChatMessages(tenantId: string, leadId: string): Promise<ChatMessage[]> {
  const conv = await vendorPool.query(
    `SELECT id FROM conversations WHERE tenant_id = $1 AND lead_id = $2 AND channel = 'praca_ai' LIMIT 1`,
    [tenantId, leadId],
  );
  if (conv.rows.length === 0) return [];

  const result = await vendorPool.query(
    `SELECT id, conteudo, enviado_por, direcao, created_at
     FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conv.rows[0].id],
  );

  return result.rows.map((r) => ({
    id: r.id,
    conteudo: r.conteudo,
    enviadoPor: r.enviado_por,
    direcao: r.direcao,
    createdAt: r.created_at,
  }));
}
interface DealItemSummary {
  productName: string;
  quantity: number;
}

/**
 * Cria um negócio (deal) no Vendor.ai a partir de um pedido do Praça.ai,
 * já marcado "Vendido" — o pipeline pós-venda do tenant assume a partir daí.
 */
export async function createDealFromPracaOrder(params: {
  tenantId: string;
  leadId: string;
  orderNumber: string;
  items: DealItemSummary[];
  valor: number;
}): Promise<string> {
  const dealId = crypto.randomUUID();
  const itemsLabel = params.items
    .map((i) => `${i.quantity}x ${i.productName}`)
    .join(", ");
  const titulo = `[Praça.ai] Pedido ${params.orderNumber} — ${itemsLabel}`.slice(0, 500);

  await vendorPool.query(
    `INSERT INTO deals (id, tenant_id, lead_id, titulo, valor, etapa, origem_pedido_praca_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'ganho', $6, now(), now())`,
    [dealId, params.tenantId, params.leadId, titulo, params.valor, params.orderNumber],
  );

  return dealId;
}
