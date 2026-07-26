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
