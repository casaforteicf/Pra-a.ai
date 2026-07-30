import { Router, type IRouter } from "express";
import { db, consumersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { listPrestadoresFrete, getTenantNome } from "../lib/freightService";
import { findOrCreateLead } from "../lib/vendorSyncService";
import { vendorPool } from "../lib/vendorDb";

const router: IRouter = Router();

router.get("/fretes/prestadores", async (_req, res): Promise<void> => {
  const prestadores = await listPrestadoresFrete();
  res.json(prestadores);
});

// Frete é sempre cotação, nunca preço fechado na hora — cria a carga com
// status cotacao_pendente e o prestador responde o valor depois.
router.post("/fretes/cotacao", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId ?? null;
  const { vendorId, enderecoColeta, enderecoEntrega, tipoCarga, pesoKg, volumeM3, guestName, guestPhone } = req.body as {
    vendorId?: string;
    enderecoColeta?: string;
    enderecoEntrega?: string;
    tipoCarga?: string;
    pesoKg?: number;
    volumeM3?: number;
    guestName?: string;
    guestPhone?: string;
  };

  if (!vendorId) {
    res.status(400).json({ error: "Escolha um prestador de frete." });
    return;
  }
  if (!enderecoColeta?.trim() || !enderecoEntrega?.trim()) {
    res.status(400).json({ error: "Endereço de coleta e de entrega são obrigatórios." });
    return;
  }

  const vendorName = await getTenantNome(vendorId);
  if (!vendorName) {
    res.status(404).json({ error: "Prestador não encontrado ou indisponível." });
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
    res.status(400).json({ error: "Nome e telefone são obrigatórios pra pedir a cotação." });
    return;
  }

  const leadId = await findOrCreateLead(vendorId, { nome, telefone, email: email ?? null, endereco: enderecoColeta });

  const { rows } = await vendorPool.query(
    `INSERT INTO fretes_cargas (id, tenant_id, cliente_id, endereco_coleta, endereco_entrega, tipo_carga, peso_kg, volume_m3, status)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, 'cotacao_pendente')
     RETURNING id, status`,
    [vendorId, leadId, enderecoColeta, enderecoEntrega, tipoCarga ?? null, pesoKg ?? null, volumeM3 ?? null],
  );

  res.status(201).json({ carga: rows[0], vendorName });
});

export default router;
