import { Router, type IRouter } from "express";
import { db, consumersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { listVeiculos, getVeiculoById } from "../lib/vehicleService";
import { findOrCreateLead } from "../lib/vendorSyncService";
import { vendorPool } from "../lib/vendorDb";

const router: IRouter = Router();

router.get("/veiculos", async (req, res): Promise<void> => {
  const { marca, precoMax } = req.query as { marca?: string; precoMax?: string };
  const veiculos = await listVeiculos({
    marca,
    precoMax: precoMax ? Number(precoMax) : undefined,
  });
  res.json(veiculos);
});

router.get("/veiculos/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const veiculo = await getVeiculoById(id);
  if (!veiculo) {
    res.status(404).json({ error: "Veículo não encontrado ou não disponível." });
    return;
  }
  res.json(veiculo);
});

// Veículo não vai pro carrinho/checkout normal — agenda test-drive em vez
// disso, criando (ou reaproveitando) o lead do lojista no Vendor.ai e
// escrevendo direto em veiculos_test_drives (tabela do Vendor.ai, mesmo
// banco físico — mesmo padrão usado no resto da integração).
router.post("/veiculos/:id/agendar-test-drive", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const consumerId = req.session?.consumerId ?? null;
  const { dataHora, guestName, guestPhone } = req.body as { dataHora?: string; guestName?: string; guestPhone?: string };

  if (!dataHora) {
    res.status(400).json({ error: "Data e hora do test-drive são obrigatórias." });
    return;
  }

  const veiculo = await getVeiculoById(id);
  if (!veiculo) {
    res.status(404).json({ error: "Veículo não encontrado ou não disponível." });
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
    res.status(400).json({ error: "Nome e telefone são obrigatórios pra agendar o test-drive." });
    return;
  }

  const leadId = await findOrCreateLead(veiculo.vendorId, { nome, telefone, email: email ?? null, endereco: "" });

  const { rows } = await vendorPool.query(
    `INSERT INTO veiculos_test_drives (id, tenant_id, veiculo_id, cliente_id, data_hora, status)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'agendado')
     RETURNING id, data_hora, status`,
    [veiculo.vendorId, veiculo.id, leadId, dataHora],
  );

  res.status(201).json({ testDrive: rows[0], veiculo: { marca: veiculo.marca, modelo: veiculo.modelo, vendorName: veiculo.vendorName } });
});

export default router;
