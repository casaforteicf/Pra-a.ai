import { Router, type IRouter } from "express";
import { db, consumersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { listServicosTipos, getServicoTipoById } from "../lib/serviceOrderService";
import { findOrCreateLead } from "../lib/vendorSyncService";
import { vendorPool } from "../lib/vendorDb";

const router: IRouter = Router();

router.get("/servicos/tipos", async (req, res): Promise<void> => {
  const { especialidade, categoria } = req.query as { especialidade?: string; categoria?: string };
  const tipos = await listServicosTipos({ especialidade, categoria });
  res.json(tipos);
});

router.get("/servicos/tipos/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const tipo = await getServicoTipoById(id);
  if (!tipo) {
    res.status(404).json({ error: "Serviço não encontrado ou indisponível." });
    return;
  }
  res.json(tipo);
});

// Serviço (pedreiro/eletricista/encanador) não tem preço fechado na
// maioria dos casos — o pedido cria uma "ordem de serviço" pedindo
// orçamento, não uma compra direta. Prestador confirma valor depois da
// visita técnica (se necessária).
router.post("/servicos/solicitar", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId ?? null;
  const { tipoServicoId, enderecoAtendimento, observacoes, guestName, guestPhone } = req.body as {
    tipoServicoId?: string;
    enderecoAtendimento?: string;
    observacoes?: string;
    guestName?: string;
    guestPhone?: string;
  };

  if (!tipoServicoId) {
    res.status(400).json({ error: "Tipo de serviço é obrigatório." });
    return;
  }
  if (!enderecoAtendimento || !enderecoAtendimento.trim()) {
    res.status(400).json({ error: "Endereço de atendimento é obrigatório." });
    return;
  }

  const tipo = await getServicoTipoById(tipoServicoId);
  if (!tipo) {
    res.status(404).json({ error: "Serviço não encontrado ou indisponível." });
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
    res.status(400).json({ error: "Nome e telefone são obrigatórios pra solicitar o serviço." });
    return;
  }

  const leadId = await findOrCreateLead(tipo.vendorId, { nome, telefone, email: email ?? null, endereco: enderecoAtendimento });

  const { rows } = await vendorPool.query(
    `INSERT INTO servicos_ordens (id, tenant_id, cliente_id, tipo_servico_id, endereco_atendimento, status, valor_orcado, observacoes)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'orcamento_pendente', $5, $6)
     RETURNING id, status`,
    [tipo.vendorId, leadId, tipo.id, enderecoAtendimento, tipo.precoBase, observacoes ?? null],
  );

  res.status(201).json({ ordem: rows[0], vendorName: tipo.vendorName, requerVisitaTecnica: tipo.requerVisitaTecnica });
});

export default router;
