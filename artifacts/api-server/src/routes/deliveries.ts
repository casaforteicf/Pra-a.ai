import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  db, consumersTable, deliveriesTable, deliveryEventsTable, deliveryPartnersTable,
  deliveryProofsTable, ordersTable, pracaBankTransactionsTable,
} from "@workspace/db";

const router: IRouter = Router();
const MAX_ENTREGAS_SIMULTANEAS = 3;
const STATUS_ATIVOS = ["ofertada", "aceita", "chegando_coleta", "coletada", "em_transito", "chegando_entrega"];
const TRANSICOES: Record<string, string[]> = {
  aceita: ["chegando_coleta", "cancelada"],
  chegando_coleta: ["coletada", "cancelada"],
  coletada: ["em_transito", "cancelada"],
  em_transito: ["chegando_entrega", "falha_entrega"],
  chegando_entrega: ["entregue", "falha_entrega"],
  falha_entrega: ["em_transito", "devolucao"],
};

function consumerId(req: any): number | null { return req.session?.consumerId ?? null; }
function cidadeDoEndereco(raw: string): string | null {
  try { return String(JSON.parse(raw)?.city || "").trim().toLowerCase() || null; } catch { return null; }
}
async function partnerDaSessao(req: any) {
  const id = consumerId(req);
  if (!id) return null;
  const [partner] = await db.select().from(deliveryPartnersTable).where(eq(deliveryPartnersTable.consumerId, id)).limit(1);
  return partner ?? null;
}
async function evento(deliveryId: number, status: string, observacao?: string, latitude?: number, longitude?: number) {
  await db.insert(deliveryEventsTable).values({ deliveryId, status, observacao: observacao || null, latitude: latitude == null ? null : String(latitude), longitude: longitude == null ? null : String(longitude) });
}

async function encontrarParceiro(praca: string, cidadeDestino: string | null) {
  const candidatos = await db.select().from(deliveryPartnersTable).where(and(
    eq(deliveryPartnersTable.praca, praca), eq(deliveryPartnersTable.status, "disponivel"), eq(deliveryPartnersTable.documentacaoStatus, "aprovada"),
  ));
  if (!candidatos.length) return null;
  const ativas = await db.select({ partnerId: deliveriesTable.partnerId, orderId: deliveriesTable.orderId }).from(deliveriesTable).where(inArray(deliveriesTable.status, STATUS_ATIVOS));
  const carga = new Map<number, number>();
  for (const item of ativas) if (item.partnerId) carga.set(item.partnerId, (carga.get(item.partnerId) || 0) + 1);
  const disponiveis = candidatos.filter((p) => (carga.get(p.id) || 0) < MAX_ENTREGAS_SIMULTANEAS);
  disponiveis.sort((a, b) => (carga.get(a.id) || 0) - (carga.get(b.id) || 0));
  return disponiveis[0] ?? null;
}

async function ofertar(deliveryId: number) {
  const [delivery] = await db.select().from(deliveriesTable).where(eq(deliveriesTable.id, deliveryId)).limit(1);
  if (!delivery) return null;
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, delivery.orderId)).limit(1);
  const partner = await encontrarParceiro("Chapecó", order ? cidadeDoEndereco(order.deliveryAddress) : null);
  if (!partner) return delivery;
  const expira = new Date(Date.now() + 5 * 60_000);
  const [updated] = await db.update(deliveriesTable).set({ partnerId: partner.id, status: "ofertada", ofertaExpiraEm: expira }).where(eq(deliveriesTable.id, delivery.id)).returning();
  await evento(delivery.id, "ofertada", `Oferta enviada para ${partner.nome}`);
  return updated;
}

router.post("/logistica/entregadores/cadastro", async (req, res): Promise<void> => {
  const id = consumerId(req);
  if (!id) return void res.status(401).json({ error: "Entre na sua conta para se cadastrar." });
  const { cpf, documentoFotoUrl, selfieUrl, cnhUrl, veiculoDocumentoUrl, veiculoTipo, placa, praca = "Chapecó" } = req.body;
  if (!cpf || !documentoFotoUrl || !selfieUrl || !veiculoTipo) return void res.status(400).json({ error: "CPF, documento com foto, selfie e veículo são obrigatórios." });
  const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.id, id)).limit(1);
  if (!consumer?.phone) return void res.status(400).json({ error: "Cadastre seu telefone em Meus dados antes de continuar." });
  const [existing] = await db.select().from(deliveryPartnersTable).where(eq(deliveryPartnersTable.consumerId, id)).limit(1);
  const values = { consumerId: id, nome: consumer.name, telefone: consumer.phone, cpf, documentoFotoUrl, selfieUrl, cnhUrl: cnhUrl || null, veiculoDocumentoUrl: veiculoDocumentoUrl || null, veiculoTipo, placa: placa || null, praca, documentacaoStatus: "pendente", status: "offline" };
  const [partner] = existing
    ? await db.update(deliveryPartnersTable).set(values).where(eq(deliveryPartnersTable.id, existing.id)).returning()
    : await db.insert(deliveryPartnersTable).values(values).returning();
  res.status(existing ? 200 : 201).json(partner);
});

router.get("/logistica/entregador/me", async (req, res): Promise<void> => {
  const partner = await partnerDaSessao(req);
  if (!partner) return void res.status(404).json({ error: "Cadastro de entregador não encontrado." });
  const entregas = await db.select({ delivery: deliveriesTable, order: ordersTable }).from(deliveriesTable).innerJoin(ordersTable, eq(deliveriesTable.orderId, ordersTable.id)).where(eq(deliveriesTable.partnerId, partner.id)).orderBy(desc(deliveriesTable.createdAt));
  const transacoes = await db.select().from(pracaBankTransactionsTable).where(eq(pracaBankTransactionsTable.partnerId, partner.id)).orderBy(desc(pracaBankTransactionsTable.createdAt));
  const saldo = transacoes.filter((t) => t.status === "disponivel").reduce((sum, t) => sum + Number(t.valor), 0);
  res.json({ partner, entregas, pracaBank: { saldo, transacoes } });
});

router.patch("/logistica/entregador/disponibilidade", async (req, res): Promise<void> => {
  const partner = await partnerDaSessao(req);
  if (!partner) return void res.status(404).json({ error: "Entregador não encontrado." });
  if (partner.documentacaoStatus !== "aprovada") return void res.status(409).json({ error: "Aguarde a aprovação da documentação." });
  const status = req.body.online ? "disponivel" : "offline";
  const [updated] = await db.update(deliveryPartnersTable).set({ status }).where(eq(deliveryPartnersTable.id, partner.id)).returning();
  res.json(updated);
});

router.patch("/logistica/entregador/localizacao", async (req, res): Promise<void> => {
  const partner = await partnerDaSessao(req);
  const { latitude, longitude } = req.body;
  if (!partner) return void res.status(404).json({ error: "Entregador não encontrado." });
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return void res.status(400).json({ error: "Localização inválida." });
  await db.update(deliveryPartnersTable).set({ latitude: String(latitude), longitude: String(longitude), localizacaoEm: new Date() }).where(eq(deliveryPartnersTable.id, partner.id));
  res.json({ ok: true });
});

router.post("/logistica/entregas/:id/resposta", async (req, res): Promise<void> => {
  const partner = await partnerDaSessao(req);
  const deliveryId = Number(req.params.id);
  const aceitar = req.body.aceitar === true;
  if (!partner) return void res.status(401).json({ error: "Acesso exclusivo do entregador." });
  const [delivery] = await db.select().from(deliveriesTable).where(and(eq(deliveriesTable.id, deliveryId), eq(deliveriesTable.partnerId, partner.id))).limit(1);
  if (!delivery || delivery.status !== "ofertada") return void res.status(409).json({ error: "Esta oferta não está mais disponível." });
  if (delivery.ofertaExpiraEm && delivery.ofertaExpiraEm < new Date()) return void res.status(410).json({ error: "A oferta expirou." });
  if (!aceitar) {
    await db.update(deliveriesTable).set({ partnerId: null, status: "aguardando_motorista", ofertaExpiraEm: null }).where(eq(deliveriesTable.id, deliveryId));
    await evento(deliveryId, "recusada", `Oferta recusada por ${partner.nome}`);
    const next = await ofertar(deliveryId);
    return void res.json(next);
  }
  const [updated] = await db.update(deliveriesTable).set({ status: "aceita", aceitaEm: new Date(), ofertaExpiraEm: null }).where(eq(deliveriesTable.id, deliveryId)).returning();
  await db.update(deliveryPartnersTable).set({ status: "em_entrega" }).where(eq(deliveryPartnersTable.id, partner.id));
  await evento(deliveryId, "aceita");
  res.json(updated);
});

router.patch("/logistica/entregas/:id/status", async (req, res): Promise<void> => {
  const partner = await partnerDaSessao(req);
  const deliveryId = Number(req.params.id);
  const { status, observacao, latitude, longitude } = req.body;
  if (!partner) return void res.status(401).json({ error: "Acesso exclusivo do entregador." });
  const [delivery] = await db.select().from(deliveriesTable).where(and(eq(deliveriesTable.id, deliveryId), eq(deliveriesTable.partnerId, partner.id))).limit(1);
  if (!delivery) return void res.status(404).json({ error: "Entrega não encontrada." });
  if (!(TRANSICOES[delivery.status] || []).includes(status)) return void res.status(409).json({ error: `Não é possível passar de ${delivery.status} para ${status}.` });
  if (status === "entregue") {
    const [proof] = await db.select().from(deliveryProofsTable).where(eq(deliveryProofsTable.deliveryId, deliveryId)).limit(1);
    if (!proof) return void res.status(409).json({ error: "Envie o comprovante antes de concluir." });
  }
  const updates: any = { status };
  if (status === "coletada") updates.coletadaEm = new Date();
  if (status === "entregue") updates.entregueEm = new Date();
  const [updated] = await db.update(deliveriesTable).set(updates).where(eq(deliveriesTable.id, deliveryId)).returning();
  await evento(deliveryId, status, observacao, latitude, longitude);
  if (status === "em_transito") await db.update(ordersTable).set({ status: "out_for_delivery" }).where(eq(ordersTable.id, delivery.orderId));
  if (status === "entregue") {
    await db.update(ordersTable).set({ status: "delivered" }).where(eq(ordersTable.id, delivery.orderId));
    const valor = delivery.valorPagoParceiro || "0";
    await db.insert(pracaBankTransactionsTable).values({ partnerId: partner.id, deliveryId, valor, status: "disponivel", descricao: `Entrega #${deliveryId} concluída`, disponivelEm: new Date() }).onConflictDoNothing();
    const [{ restantes }] = await db.select({ restantes: sql<number>`count(*)` }).from(deliveriesTable).where(and(eq(deliveriesTable.partnerId, partner.id), inArray(deliveriesTable.status, STATUS_ATIVOS)));
    if (Number(restantes) === 0) await db.update(deliveryPartnersTable).set({ status: "disponivel" }).where(eq(deliveryPartnersTable.id, partner.id));
  }
  res.json(updated);
});

router.post("/logistica/entregas/:id/comprovante", async (req, res): Promise<void> => {
  const partner = await partnerDaSessao(req);
  const deliveryId = Number(req.params.id);
  const { tipo, arquivoUrl, recebedorNome, consentimentoPessoa, observacao, latitude, longitude } = req.body;
  if (!partner) return void res.status(401).json({ error: "Acesso exclusivo do entregador." });
  if (!["foto_local", "documento_coletado"].includes(tipo) || !arquivoUrl) return void res.status(400).json({ error: "Selecione o tipo e envie o comprovante." });
  const [delivery] = await db.select().from(deliveriesTable).where(and(eq(deliveriesTable.id, deliveryId), eq(deliveriesTable.partnerId, partner.id))).limit(1);
  if (!delivery) return void res.status(404).json({ error: "Entrega não encontrada." });
  const [proof] = await db.insert(deliveryProofsTable).values({ deliveryId, tipo, arquivoUrl, recebedorNome: recebedorNome || null, consentimentoPessoa: Boolean(consentimentoPessoa), observacao: observacao || null, latitude: latitude == null ? null : String(latitude), longitude: longitude == null ? null : String(longitude) }).returning();
  res.status(201).json(proof);
});

router.post("/pedidos/:id/entrega", async (req, res): Promise<void> => {
  const orderId = Number(req.params.id);
  const { vendorId, supportPointId, larguraCm, alturaCm, profundidadeCm, pesoKg, volumeFotoUrl, valorPagoParceiro } = req.body;
  if (!orderId || !vendorId) return void res.status(400).json({ error: "Pedido e vendedor são obrigatórios." });
  const [delivery] = await db.insert(deliveriesTable).values({ orderId, vendorId, supportPointId: supportPointId || null, status: "preparando", larguraCm: larguraCm ? String(larguraCm) : null, alturaCm: alturaCm ? String(alturaCm) : null, profundidadeCm: profundidadeCm ? String(profundidadeCm) : null, pesoKg: pesoKg ? String(pesoKg) : null, volumeFotoUrl: volumeFotoUrl || null, valorPagoParceiro: valorPagoParceiro ? String(valorPagoParceiro) : "0" }).returning();
  await evento(delivery.id, "preparando");
  res.status(201).json(delivery);
});

router.post("/logistica/entregas/:id/pronto", async (req, res): Promise<void> => {
  const deliveryId = Number(req.params.id);
  const [delivery] = await db.update(deliveriesTable).set({ status: "aguardando_motorista" }).where(and(eq(deliveriesTable.id, deliveryId), eq(deliveriesTable.status, "preparando"))).returning();
  if (!delivery) return void res.status(409).json({ error: "Entrega não está em preparação." });
  await evento(deliveryId, "pronto_coleta");
  res.json(await ofertar(deliveryId));
});

router.get("/pedidos/:id/rastreio", async (req, res): Promise<void> => {
  const orderId = Number(req.params.id);
  const [delivery] = await db.select().from(deliveriesTable).where(eq(deliveriesTable.orderId, orderId)).limit(1);
  if (!delivery) return void res.status(404).json({ error: "Nenhuma entrega associada a este pedido." });
  const events = await db.select().from(deliveryEventsTable).where(eq(deliveryEventsTable.deliveryId, delivery.id)).orderBy(deliveryEventsTable.createdAt);
  res.json({ ...delivery, events });
});

// Compatibilidade com integrações anteriores.
router.patch("/entregas/:id/status", async (_req, res) => res.status(410).json({ error: "Use o fluxo autenticado /logistica/entregas/:id/status." }));
router.post("/entregas/:id/tentar-atribuir", async (req, res) => res.json(await ofertar(Number(req.params.id))));

export default router;
