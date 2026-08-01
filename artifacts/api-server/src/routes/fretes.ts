import { Router, type IRouter } from "express";
import { db, consumersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { listTiposVeiculoDisponiveis, escolherPrestadorPorTipoVeiculo } from "../lib/freightService";
import { findOrCreateLead } from "../lib/vendorSyncService";
import { vendorPool } from "../lib/vendorDb";

const router: IRouter = Router();

router.get("/fretes/tipos-veiculo", async (_req, res): Promise<void> => {
  const tipos = await listTiposVeiculoDisponiveis();
  res.json(tipos);
});

// Frete é sempre cotação, nunca preço fechado na hora — cria a carga com
// status cotacao_pendente e o transportador responde o valor depois. O
// cliente escolhe só o TIPO de veículo (não uma empresa específica) — o
// sistema escolhe automaticamente quem atende, balanceando pela carga ativa.
router.post("/fretes/cotacao", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId ?? null;
  const { tipoVeiculoDesejado, enderecoColeta, enderecoEntrega, tipoCarga, pesoKg, volumeM3, guestName, guestPhone } = req.body as {
    tipoVeiculoDesejado?: string;
    enderecoColeta?: string;
    enderecoEntrega?: string;
    tipoCarga?: string;
    pesoKg?: number;
    volumeM3?: number;
    guestName?: string;
    guestPhone?: string;
  };

  if (!tipoVeiculoDesejado) {
    res.status(400).json({ error: "Escolha o tipo de veículo que você precisa." });
    return;
  }
  if (!enderecoColeta?.trim() || !enderecoEntrega?.trim()) {
    res.status(400).json({ error: "Endereço de coleta e de entrega são obrigatórios." });
    return;
  }

  const prestador = await escolherPrestadorPorTipoVeiculo(tipoVeiculoDesejado);
  if (!prestador) {
    res.status(404).json({ error: "Nenhum transportador com esse tipo de veículo disponível agora." });
    return;
  }
  const { vendorId, vendorName } = prestador;

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
    res.status(400).json({ error: "Nome e telefone são obrigatórios pra pedir a cotação." });
    return;
  }

  const leadId = await findOrCreateLead(vendorId, { nome, telefone, email: email ?? null, endereco: enderecoColeta });

  const { rows } = await vendorPool.query(
    `INSERT INTO fretes_cargas (id, tenant_id, cliente_id, tipo_veiculo_desejado, origem, endereco_coleta, endereco_entrega, tipo_carga, peso_kg, volume_m3, status)
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'cliente_final', $4, $5, $6, $7, $8, 'cotacao_pendente')
     RETURNING id, status`,
    [vendorId, leadId, tipoVeiculoDesejado, enderecoColeta, enderecoEntrega, tipoCarga ?? null, pesoKg ?? null, volumeM3 ?? null],
  );

  res.status(201).json({ carga: rows[0], vendorName });
});

export default router;
