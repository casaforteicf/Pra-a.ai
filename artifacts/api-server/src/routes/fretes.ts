import { Router, type IRouter } from "express";
import { db, consumersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { listTiposVeiculoDisponiveis, escolherPrestadorPorTipoVeiculo } from "../lib/freightService";
import { findOrCreateLead } from "../lib/vendorSyncService";
import { vendorPool } from "../lib/vendorDb";

const router: IRouter = Router();

const nominatimHeaders = {
  Accept: "application/json",
  "Accept-Language": "pt-BR,pt;q=0.9",
  "User-Agent": "Praca.ai/1.0 (appvendorai.com)",
};

type NominatimPlace = { display_name: string; lat: string; lon: string };

async function searchAddress(query: string, limit = 5): Promise<NominatimPlace[]> {
  const params = new URLSearchParams({ q: query, format: "jsonv2", addressdetails: "1", countrycodes: "br", limit: String(limit) });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: nominatimHeaders, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("Serviço de localização indisponível");
  return response.json() as Promise<NominatimPlace[]>;
}

router.get("/localizacao/cep", async (req, res): Promise<void> => {
  const cep = String(req.query.cep ?? "").replace(/\D/g, "");
  if (cep.length !== 8) { res.status(400).json({ error: "Informe um CEP com 8 números." }); return; }
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error("Falha ao consultar CEP");
    const data = await response.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string; cep?: string };
    if (data.erro) { res.status(404).json({ error: "CEP não encontrado." }); return; }
    const address = [data.logradouro, data.bairro, data.localidade, data.uf, data.cep].filter(Boolean).join(", ");
    const [place] = await searchAddress(address, 1);
    res.json({ address, cep: data.cep, lat: place ? Number(place.lat) : null, lng: place ? Number(place.lon) : null });
  } catch {
    res.status(502).json({ error: "Não foi possível consultar o CEP agora." });
  }
});

router.get("/localizacao/busca", async (req, res): Promise<void> => {
  const query = String(req.query.q ?? "").trim();
  if (query.length < 3 || query.length > 200) { res.status(400).json({ error: "Digite ao menos 3 caracteres para buscar." }); return; }
  try {
    const places = await searchAddress(query);
    res.json(places.map((place) => ({ address: place.display_name, lat: Number(place.lat), lng: Number(place.lon) })));
  } catch {
    res.status(502).json({ error: "Não foi possível buscar o endereço agora." });
  }
});

router.get("/localizacao/reversa", async (req, res): Promise<void> => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) { res.status(400).json({ error: "Coordenadas inválidas." }); return; }
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: "jsonv2", addressdetails: "1", layer: "address" });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { headers: nominatimHeaders, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error("Falha na busca reversa");
    const place = await response.json() as NominatimPlace;
    res.json({ address: place.display_name, lat, lng });
  } catch {
    res.status(502).json({ error: "Não foi possível identificar o endereço deste ponto." });
  }
});

router.get("/fretes/tipos-veiculo", async (_req, res): Promise<void> => {
  const tipos = await listTiposVeiculoDisponiveis();
  res.json(tipos);
});

// Frete é sempre cotação, nunca preço fechado na hora — cria a carga com
// status cotacao_pendente e o transportador responde o valor depois. O
// cliente escolhe só o TIPO de veículo (não uma empresa específica) — o
// sistema escolhe automaticamente quem atende, balanceando pela carga ativa.
// Login obrigatório aqui (diferente de outras telas do Praça.ai) — nome e
// telefone vêm sempre da conta, sem fluxo de guest.
router.post("/fretes/cotacao", async (req, res): Promise<void> => {
  const consumerId = req.session?.consumerId ?? null;
  if (!consumerId) {
    res.status(401).json({ error: "Faça login pra solicitar um frete." });
    return;
  }

  const {
    tipoVeiculoDesejado, enderecoColeta, enderecoEntrega,
    enderecoColetaLat, enderecoColetaLng, enderecoEntregaLat, enderecoEntregaLng,
    tipoCarga, pesoKg, volumeM3,
  } = req.body as {
    tipoVeiculoDesejado?: string;
    enderecoColeta?: string;
    enderecoEntrega?: string;
    enderecoColetaLat?: number;
    enderecoColetaLng?: number;
    enderecoEntregaLat?: number;
    enderecoEntregaLng?: number;
    tipoCarga?: string;
    pesoKg?: number;
    volumeM3?: number;
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

  const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.id, consumerId)).limit(1);
  if (!consumer?.name || !consumer?.phone) {
    res.status(400).json({ error: "Complete seu nome e telefone no perfil pra pedir um frete." });
    return;
  }
  const { name: nome, phone: telefone, email } = consumer;

  const leadId = await findOrCreateLead(vendorId, { nome, telefone, email: email ?? null, endereco: enderecoColeta });

  const { rows } = await vendorPool.query(
    `INSERT INTO fretes_cargas (id, tenant_id, cliente_id, tipo_veiculo_desejado, origem, endereco_coleta, endereco_entrega, endereco_coleta_lat, endereco_coleta_lng, endereco_entrega_lat, endereco_entrega_lng, tipo_carga, peso_kg, volume_m3, status)
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'cliente_final', $4, $5, $6, $7, $8, $9, $10, $11, $12, 'cotacao_pendente')
     RETURNING id, status`,
    [
      vendorId, leadId, tipoVeiculoDesejado, enderecoColeta, enderecoEntrega,
      enderecoColetaLat ?? null, enderecoColetaLng ?? null, enderecoEntregaLat ?? null, enderecoEntregaLng ?? null,
      tipoCarga ?? null, pesoKg ?? null, volumeM3 ?? null,
    ],
  );

  res.status(201).json({ carga: rows[0], vendorName });
});

export default router;
