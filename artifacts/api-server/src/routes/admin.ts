import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { desc, and } from "drizzle-orm";
import { db, ambassadorsTable, referralsTable, disputesTable, consumersTable, vendorPayoutsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { vendorPool } from "../lib/vendorDb";
import { pool } from "@workspace/db";
import { AsaasApiError, refundCharge } from "../lib/asaas";

const router: IRouter = Router();

/**
 * Autenticação de admin — medida provisória real, não sistema completo.
 * Praça.ai não tem conta de admin própria (login, perfis, auditoria por
 * usuário) ainda — construir isso é decisão maior que exige credencial e
 * definição de quem tem acesso, não algo pra decidir sozinho no código.
 *
 * Isso aqui fecha o buraco real que existia (qualquer um com a URL
 * acessava sem barreira nenhuma): agora exige uma chave secreta
 * compartilhada via header, configurada como PRACA_ADMIN_API_KEY nos
 * Secrets do Replit. Não é rastreável por usuário — é um perímetro, não
 * uma conta. Quando existir tela de admin de verdade, isso deve ser
 * substituído por login + sessão própria.
 */
function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const configuredKey = process.env.PRACA_ADMIN_API_KEY;
  if (!configuredKey) {
    // Sem chave configurada, os endpoints ficam bloqueados por padrão —
    // nunca abertos "por esquecimento" de configurar o secret.
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

// Escopo restrito a /admin/* — sem isso, esse middleware bloqueava
// (por engano) TODAS as rotas registradas depois dele no index.ts,
// incluindo veículos/imóveis/farmácia/restaurantes/serviços/fretes, já
// que router.use(fn) sem path aplica pra qualquer requisição que passe
// por esse router, não só as que batem com uma rota definida nele.
router.use("/admin", requireAdminKey);

router.get("/admin/embaixadores", async (_req, res): Promise<void> => {
  const ambassadors = await db
    .select({
      id: ambassadorsTable.id,
      codigo: ambassadorsTable.codigo,
      saldoComissao: ambassadorsTable.saldoComissao,
      status: ambassadorsTable.status,
      createdAt: ambassadorsTable.createdAt,
      nome: consumersTable.name,
      email: consumersTable.email,
    })
    .from(ambassadorsTable)
    .innerJoin(consumersTable, eq(consumersTable.id, ambassadorsTable.consumerId))
    .orderBy(desc(ambassadorsTable.createdAt));

  res.json(ambassadors);
});

router.get("/admin/embaixadores/:id/indicacoes", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const ambassadorId = parseInt(id, 10);
  if (isNaN(ambassadorId)) {
    res.status(404).json({ error: "Embaixador não encontrado" });
    return;
  }

  const referrals = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.ambassadorId, ambassadorId))
    .orderBy(desc(referralsTable.createdAt));

  res.json(referrals);
});

router.patch("/admin/embaixadores/:id/status", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const ambassadorId = parseInt(id, 10);
  const { status } = req.body as { status?: string };

  if (isNaN(ambassadorId) || !["ativo", "bloqueado"].includes(status ?? "")) {
    res.status(400).json({ error: "Status inválido." });
    return;
  }

  const [updated] = await db
    .update(ambassadorsTable)
    .set({ status })
    .where(eq(ambassadorsTable.id, ambassadorId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Embaixador não encontrado" });
    return;
  }

  res.json(updated);
});

router.get("/admin/disputas", async (req, res): Promise<void> => {
  const { status } = req.query as { status?: string };

  const disputas = status
    ? await db.select().from(disputesTable).where(eq(disputesTable.status, status)).orderBy(desc(disputesTable.createdAt))
    : await db.select().from(disputesTable).orderBy(desc(disputesTable.createdAt));

  res.json(disputas);
});

router.get("/admin/marketplace-disputas", async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const allowed = ["aberta", "em_analise", "aguardando_comprador", "resolvida", "rejeitada"];
  if (status && !allowed.includes(status)) return void res.status(422).json({ error: "Filtro de status inválido." });
  const result = await pool.query(
    `SELECT d.id,d.order_type,d.order_id,d.reason_code,d.description,d.evidence_url,d.status,d.vendor_response,d.vendor_responded_at,
            (SELECT e.note FROM praca_order_dispute_events e WHERE e.dispute_id=d.id AND e.actor_type='buyer'
             AND e.from_status='aguardando_comprador' ORDER BY e.created_at DESC,e.id DESC LIMIT 1) AS buyer_response,
            d.resolution_text,d.created_at,d.updated_at,d.resolved_at,d.vendor_id,
            c.name AS buyer_name,c.email AS buyer_email,
            COALESCE(q.protocol,r.code) AS order_code,
            COALESCE(q.title,r.item_name) AS item_title,
            COALESCE(q.location,concat(r.city,', ',r.state)) AS location
     FROM praca_order_disputes d
     JOIN consumers c ON c.id=d.consumer_id
     LEFT JOIN quote_requests q ON d.order_type='quote' AND q.id=d.order_id
     LEFT JOIN buying_round_orders o ON d.order_type='round' AND o.id=d.order_id
     LEFT JOIN buying_rounds r ON r.id=o.round_id
     WHERE ($1='' OR d.status=$1)
     ORDER BY CASE WHEN d.status IN ('aberta','em_analise','aguardando_comprador') THEN 0 ELSE 1 END,
              d.created_at DESC LIMIT 300`,
    [status],
  );
  res.set("Cache-Control", "no-store").json(result.rows);
});

router.patch("/admin/marketplace-disputas/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id ?? "");
  const status = String(req.body?.status ?? "");
  const note = typeof req.body?.resolutionText === "string" ? req.body.resolutionText.trim().slice(0, 3000) : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["em_analise", "aguardando_comprador", "resolvida", "rejeitada"].includes(status)) {
    return void res.status(422).json({ error: "Atualização de disputa inválida." });
  }
  if (["aguardando_comprador", "resolvida", "rejeitada"].includes(status) && note.length < 8) {
    return void res.status(422).json({ error: "Registre uma observação antes de solicitar resposta ou concluir a disputa." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT status FROM praca_order_disputes WHERE id=$1 FOR UPDATE", [id]);
    if (!existing.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Disputa não encontrada." }); }
    const fromStatus = String(existing.rows[0].status);
    if (["resolvida", "rejeitada"].includes(fromStatus)) {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "Uma disputa concluída não pode ser alterada." });
    }
    const allowedTransitions: Record<string, string[]> = {
      aberta: ["em_analise"],
      em_analise: ["aguardando_comprador", "resolvida", "rejeitada"],
      aguardando_comprador: ["em_analise", "resolvida", "rejeitada"],
    };
    if (!(allowedTransitions[fromStatus] ?? []).includes(status)) {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "Transição de status inválida para esta disputa." });
    }
    const updated = await client.query(
      `UPDATE praca_order_disputes SET status=$2,resolution_text=$3,updated_at=now(),
         resolved_at=CASE WHEN $2 IN ('resolvida','rejeitada') THEN now() ELSE NULL END
       WHERE id=$1 RETURNING id,status,resolution_text,updated_at,resolved_at`,
      [id, status, note || null],
    );
    await client.query(
      `INSERT INTO praca_order_dispute_events(dispute_id,from_status,to_status,actor_type,note)
       VALUES($1,$2,$3,'admin',$4)`,
      [id, fromStatus, status, note || null],
    );
    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[admin] marketplace dispute update failed:", error);
    res.status(500).json({ error: "Não foi possível atualizar a disputa." });
  } finally { client.release(); }
});

router.get("/admin/marketplace-cancelamentos", async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const allowed = ["solicitada", "em_analise", "atendida", "recusada"];
  if (status && !allowed.includes(status)) return void res.status(422).json({ error: "Filtro de status inválido." });
  const result = await pool.query(
    `SELECT x.id,x.order_type,x.order_id,x.reason,x.description,x.status,x.resolution_note,
            x.refund_status,x.asaas_refund_requested_at,x.asaas_refunded_at,x.refund_error,
            x.created_at,x.updated_at,x.resolved_at,
            x.vendor_id,c.name AS buyer_name,c.email AS buyer_email,
            COALESCE(q.protocol,r.code) AS order_code,
            COALESCE(q.title,r.item_name) AS item_title,
            COALESCE(q.location,concat(r.city,', ',r.state)) AS location
       FROM praca_order_cancellations x
       JOIN consumers c ON c.id=x.consumer_id
       LEFT JOIN quote_requests q ON x.order_type='quote' AND q.id=x.order_id
       LEFT JOIN buying_round_orders o ON x.order_type='round' AND o.id=x.order_id
       LEFT JOIN buying_rounds r ON r.id=o.round_id
      WHERE ($1='' OR x.status=$1)
      ORDER BY CASE WHEN x.status IN ('solicitada','em_analise') THEN 0 ELSE 1 END,x.created_at DESC
      LIMIT 300`, [status],
  );
  res.set("Cache-Control", "no-store").json(result.rows);
});

router.post("/admin/marketplace-cancelamentos/:id/estorno", async (req, res): Promise<void> => {
  const id = String(req.params.id ?? "");
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return void res.status(422).json({ error: "Solicitação inválida." });
  if (note.length < 8) return void res.status(422).json({ error: "Informe o motivo da autorização do estorno." });

  const client = await pool.connect();
  let chargeId = "";
  try {
    await client.query("BEGIN");
    const found = await client.query(
      "SELECT id,order_type,order_id,status,refund_status FROM praca_order_cancellations WHERE id=$1 FOR UPDATE",
      [id],
    );
    const cancellation = found.rows[0];
    if (!cancellation) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Solicitação não encontrada." }); }
    if (cancellation.status !== "em_analise") {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "Coloque a solicitação em análise antes de autorizar o estorno." });
    }
    if (!["nao_solicitado", "negado"].includes(String(cancellation.refund_status))) {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "Já existe um estorno solicitado ou que precisa de conciliação. Não repita a operação." });
    }

    const order = cancellation.order_type === "quote"
      ? await client.query(
        `SELECT q.status,q.asaas_charge_id,f.status AS fulfillment_status
           FROM quote_requests q LEFT JOIN praca_marketplace_fulfillments f ON f.order_type='quote' AND f.order_id=q.id
          WHERE q.id=$1 FOR UPDATE OF q`, [cancellation.order_id],
      )
      : await client.query(
        `SELECT o.status,o.asaas_charge_id,f.status AS fulfillment_status
           FROM buying_round_orders o LEFT JOIN praca_marketplace_fulfillments f ON f.order_type='round' AND f.order_id=o.id
          WHERE o.id=$1 FOR UPDATE OF o`, [cancellation.order_id],
      );
    const payment = order.rows[0];
    if (!payment || payment.status !== "paid" || !payment.asaas_charge_id) {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "Só é possível estornar pedido pago com cobrança Asaas vinculada." });
    }
    if (payment.fulfillment_status === "shipped") {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "O pedido já saiu para entrega; encaminhe o caso pela disputa e conciliação manual." });
    }
    chargeId = String(payment.asaas_charge_id);
    await client.query(
      `UPDATE praca_order_cancellations
          SET refund_status='solicitado',asaas_refund_requested_at=now(),refund_error=NULL,updated_at=now()
        WHERE id=$1`, [id],
    );
    await client.query(
      `INSERT INTO praca_order_cancellation_events(cancellation_id,from_status,to_status,actor_type,note)
       VALUES($1,'em_analise','em_analise','admin',$2)`,
      [id, `Estorno integral solicitado no Asaas pelo painel administrativo. Motivo: ${note}`],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[admin] marketplace refund reservation failed:", error);
    return void res.status(500).json({ error: "Não foi possível preparar o estorno." });
  } finally { client.release(); }

  try {
    await refundCharge(chargeId, `Praça.ai cancelamento ${id}: ${note}`);
    await pool.query(
      `UPDATE praca_order_cancellations SET refund_status='em_processamento',updated_at=now()
        WHERE id=$1 AND refund_status='solicitado'`,
      [id],
    );
    return void res.json({ id, refundStatus: "em_processamento", message: "Pedido de estorno enviado ao Asaas. A confirmação será atualizada pelo webhook." });
  } catch (error) {
    const definitive = error instanceof AsaasApiError && error.status >= 400 && error.status < 500;
    const refundStatus = definitive ? "negado" : "reconciliacao";
    await pool.query(
      `UPDATE praca_order_cancellations SET refund_status=$2,refund_error=$3,updated_at=now() WHERE id=$1 AND refund_status='solicitado'`,
      [id, refundStatus, definitive ? "O Asaas recusou a solicitação. Revise o motivo/condições antes de tentar novamente." : "Resposta inconclusiva do Asaas. Consulte a cobrança no painel Asaas antes de qualquer nova tentativa."],
    );
    console.error("[admin] Asaas refund request failed:", error);
    return void res.status(definitive ? 422 : 502).json({
      error: definitive
        ? "O Asaas recusou o estorno. A solicitação foi marcada como negada para revisão."
        : "Não foi possível confirmar a resposta do Asaas. O caso foi bloqueado para conciliação manual; não repita o estorno até consultar a cobrança.",
      refundStatus,
    });
  }
});

router.patch("/admin/marketplace-cancelamentos/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id ?? ""), status = String(req.body?.status ?? "");
  const note = typeof req.body?.resolutionNote === "string" ? req.body.resolutionNote.trim().slice(0, 2000) : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["em_analise", "atendida", "recusada"].includes(status)) {
    return void res.status(422).json({ error: "Atualização de solicitação inválida." });
  }
  if (["atendida", "recusada"].includes(status) && note.length < 8) {
    return void res.status(422).json({ error: "Registre o resultado do atendimento antes de concluir a solicitação." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT status,refund_status FROM praca_order_cancellations WHERE id=$1 FOR UPDATE", [id]);
    if (!existing.rows[0]) { await client.query("ROLLBACK"); return void res.status(404).json({ error: "Solicitação não encontrada." }); }
    const fromStatus = String(existing.rows[0].status);
    const transitions: Record<string, string[]> = { solicitada: ["em_analise"], em_analise: ["atendida", "recusada"] };
    if (!(transitions[fromStatus] ?? []).includes(status)) {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "Esta solicitação já foi concluída ou a transição não é permitida." });
    }
    if (status === "atendida") {
      if (existing.rows[0]?.refund_status !== "estornado") {
        await client.query("ROLLBACK");
        return void res.status(409).json({ error: "O atendimento só pode ser concluído após confirmação do estorno pelo Asaas." });
      }
    }
    if (status === "recusada" && !["nao_solicitado", "negado"].includes(String(existing.rows[0]?.refund_status))) {
      await client.query("ROLLBACK");
      return void res.status(409).json({ error: "Não recuse enquanto o estorno estiver em processamento ou aguardando conciliação." });
    }
    const updated = await client.query(
      `UPDATE praca_order_cancellations SET status=$2,resolution_note=$3,updated_at=now(),
         resolved_at=CASE WHEN $2 IN ('atendida','recusada') THEN now() ELSE NULL END
       WHERE id=$1 RETURNING id,status,resolution_note,updated_at,resolved_at`, [id, status, note || null],
    );
    await client.query(
      `INSERT INTO praca_order_cancellation_events(cancellation_id,from_status,to_status,actor_type,note)
       VALUES($1,$2,$3,'admin',$4)`, [id, fromStatus, status, note || null],
    );
    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[admin] marketplace cancellation update failed:", error);
    res.status(500).json({ error: "Não foi possível atualizar a solicitação." });
  } finally { client.release(); }
});

/**
 * Razão de repasses por lojista — ver lib/db/src/schema/vendorPayouts.ts.
 * Não é split automático (sem subconta Asaas por lojista ainda): isso
 * aqui só mostra quanto cada um tem a receber, pra você repassar
 * manualmente por fora (PIX/transferência) e depois marcar como pago.
 */
router.get("/admin/repasses/resumo", async (_req, res): Promise<void> => {
  const rows = await db.select().from(vendorPayoutsTable);

  const porVendedor = new Map<string, { vendorId: string; pendente: number; pago: number; qtdPedidosPendentes: number }>();
  for (const row of rows) {
    const entry = porVendedor.get(row.vendorId) ?? { vendorId: row.vendorId, pendente: 0, pago: 0, qtdPedidosPendentes: 0 };
    if (row.status === "pendente") {
      entry.pendente += Number(row.valorLiquido);
      entry.qtdPedidosPendentes += 1;
    } else {
      entry.pago += Number(row.valorLiquido);
    }
    porVendedor.set(row.vendorId, entry);
  }

  const vendorIds = [...porVendedor.keys()];
  let nomes: Record<string, string> = {};
  if (vendorIds.length > 0) {
    const { rows: tenantRows } = await vendorPool.query<{ id: string; nome_empresa: string }>(
      `SELECT id, nome_empresa FROM tenants WHERE id = ANY($1)`,
      [vendorIds],
    );
    nomes = Object.fromEntries(tenantRows.map((t) => [t.id, t.nome_empresa]));
  }

  const resultado = [...porVendedor.values()]
    .map((v) => ({ ...v, nomeEmpresa: nomes[v.vendorId] ?? v.vendorId }))
    .sort((a, b) => b.pendente - a.pendente);

  res.json(resultado);
});

router.get("/admin/repasses/:vendorId", async (req, res): Promise<void> => {
  const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
  const { status } = req.query as { status?: string };

  const conditions = [eq(vendorPayoutsTable.vendorId, vendorId)];
  if (status) conditions.push(eq(vendorPayoutsTable.status, status));

  const repasses = await db
    .select()
    .from(vendorPayoutsTable)
    .where(and(...conditions))
    .orderBy(desc(vendorPayoutsTable.createdAt));

  res.json(repasses);
});

router.patch("/admin/repasses/:vendorId/marcar-pago", async (req, res): Promise<void> => {
  const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;

  const updated = await db
    .update(vendorPayoutsTable)
    .set({ status: "pago", pagoEm: new Date() })
    .where(and(eq(vendorPayoutsTable.vendorId, vendorId), eq(vendorPayoutsTable.status, "pendente")))
    .returning();

  res.json({ marcados: updated.length, repasses: updated });
});

/**
 * Comissão por loja — edição direta, pra ajustar conforme a demanda (sem
 * precisar de deploy). Lê/escreve direto em tenants.comissao_praca_ai_
 * percentual (tabela do Vendor.ai, mesmo banco físico).
 */
router.get("/admin/lojas", async (_req, res): Promise<void> => {
  const { rows } = await vendorPool.query<{ id: string; nome_empresa: string; comissao_praca_ai_percentual: string | null }>(
    `SELECT id, nome_empresa, comissao_praca_ai_percentual FROM tenants WHERE vende_no_praca_ai = true ORDER BY nome_empresa`,
  );
  res.json(rows.map((r) => ({
    vendorId: r.id,
    nomeEmpresa: r.nome_empresa,
    comissaoPercentual: Number(r.comissao_praca_ai_percentual ?? 8),
  })));
});

router.patch("/admin/lojas/:vendorId/comissao", async (req, res): Promise<void> => {
  const vendorId = Array.isArray(req.params.vendorId) ? req.params.vendorId[0] : req.params.vendorId;
  const { comissaoPercentual } = req.body as { comissaoPercentual?: number };

  if (typeof comissaoPercentual !== "number" || comissaoPercentual < 0 || comissaoPercentual > 100) {
    res.status(400).json({ error: "Comissão precisa ser um número entre 0 e 100." });
    return;
  }

  const { rowCount } = await vendorPool.query(
    `UPDATE tenants SET comissao_praca_ai_percentual = $1 WHERE id = $2`,
    [comissaoPercentual, vendorId],
  );

  if (rowCount === 0) {
    res.status(404).json({ error: "Loja não encontrada." });
    return;
  }

  res.json({ vendorId, comissaoPercentual });
});

router.get("/admin/negociacoes/:nsu",async(req,res):Promise<void>=>{
 if(process.env.PRACA_NSU_AUDIT_ENABLED!=="true")return void res.status(503).json({error:"Auditoria NSU em homologação."});
 const nsu=String(req.params.nsu),after=typeof req.query.after==="string"?req.query.after:"0";
 if(!/^NSU-[1-9][0-9]{0,19}$/.test(nsu)||! /^[0-9]{1,18}$/.test(after))return void res.status(422).json({error:"NSU ou página inválida."});
 try{
  const root=await pool.query("SELECT id,master_nsu,source_type,source_id,created_at FROM praca_negotiations WHERE master_nsu=$1",[nsu]);
  if(!root.rows[0])return void res.status(404).json({error:"NSU não encontrado."});
  const events=await pool.query(`SELECT e.sequence::text,l.movement_nsu,l.scope_type,l.scope_id,e.entity_type,e.entity_id,e.operation,e.actor_type,e.actor_id,e.before_data,e.after_data,e.occurred_at,e.recorded_at
   FROM praca_negotiation_events e JOIN praca_negotiation_links l ON l.entity_type=e.entity_type AND l.entity_id=e.entity_id
   WHERE e.master_id=$1 AND e.sequence>$2::bigint ORDER BY e.sequence LIMIT 201`,[root.rows[0].id,after]);
  const page=events.rows.slice(0,200);
  res.set("Cache-Control","no-store").json({negotiation:root.rows[0],events:page,nextCursor:events.rows.length>200?page[page.length-1].sequence:null});
 }catch{res.status(500).json({error:"Falha ao carregar auditoria NSU."})}
});

export default router;
