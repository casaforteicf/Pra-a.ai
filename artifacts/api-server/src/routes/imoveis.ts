import { Router, type IRouter } from "express";
import { db, consumersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { listImoveis, getImovelById } from "../lib/propertyService";
import { findOrCreateLead } from "../lib/vendorSyncService";
import { vendorPool } from "../lib/vendorDb";

const router: IRouter = Router();

router.get("/imoveis", async (req, res): Promise<void> => {
  const { finalidade, tipo, cidade, valorMax } = req.query as { finalidade?: string; tipo?: string; cidade?: string; valorMax?: string };
  const imoveis = await listImoveis({
    finalidade,
    tipo,
    cidade,
    valorMax: valorMax ? Number(valorMax) : undefined,
  });
  res.json(imoveis);
});

router.get("/imoveis/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const imovel = await getImovelById(id);
  if (!imovel) {
    res.status(404).json({ error: "Imóvel não encontrado ou não disponível." });
    return;
  }
  res.json(imovel);
});

// Imóvel não vai pro carrinho/checkout — agenda visita, criando (ou
// reaproveitando) o lead do lojista no Vendor.ai e escrevendo direto em
// imoveis_visitas (mesmo padrão do agendamento de test-drive de veículos).
router.post("/imoveis/:id/agendar-visita", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const consumerId = req.session?.consumerId ?? null;
  const { dataHora, guestName, guestPhone } = req.body as { dataHora?: string; guestName?: string; guestPhone?: string };

  if (!dataHora) {
    res.status(400).json({ error: "Data e hora da visita são obrigatórias." });
    return;
  }

  const imovel = await getImovelById(id);
  if (!imovel) {
    res.status(404).json({ error: "Imóvel não encontrado ou não disponível." });
    return;
  }

  let nome = guestName?.trim();
  let telefone = guestPhone?.trim();
  let email: string | undefined;

  if (consumerId) {
    const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.id, consumerId)).limit(1);
    if (consumer) {
      nome = consumer.name;
      telefone = consumer.phone ?? undefined;
      email = consumer.email;
    }
  }

  if (!nome || !telefone) {
    res.status(400).json({ error: "Nome e telefone são obrigatórios pra agendar a visita." });
    return;
  }

  const leadId = await findOrCreateLead(imovel.vendorId, { nome, telefone, email: email ?? null, endereco: "" });

  const { rows } = await vendorPool.query(
    `INSERT INTO imoveis_visitas (id, tenant_id, propriedade_id, cliente_id, data_hora, status)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'agendada')
     RETURNING id, data_hora, status`,
    [imovel.vendorId, imovel.id, leadId, dataHora],
  );

  res.status(201).json({ visita: rows[0], imovel: { titulo: imovel.titulo, vendorName: imovel.vendorName } });
});

export default router;
