import { vendorPool } from "./vendorDb";

/**
 * Imóveis vivem em imoveis_propriedades (tabela própria do Vendor.ai, não
 * produtos_catalogo). Praça.ai só conecta cliente e imobiliária parceira,
 * nunca atua como corretora — não guarda nem exibe CRECI próprio, é
 * responsabilidade da imobiliária.
 */

export function mapImovelRow(row: any) {
  const fotos: string[] = Array.isArray(row.fotos) ? row.fotos : [];

  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    tipo: row.tipo,
    finalidade: row.finalidade,
    endereco: row.endereco,
    bairro: row.bairro,
    cidade: row.cidade,
    areaM2: row.area_m2 != null ? Number(row.area_m2) : null,
    quartos: row.quartos,
    banheiros: row.banheiros,
    vagas: row.vagas,
    valor: Number(row.valor ?? 0),
    valorCondominio: row.valor_condominio != null ? Number(row.valor_condominio) : null,
    valorIptu: row.valor_iptu != null ? Number(row.valor_iptu) : null,
    fotos,
    imageUrl: fotos[0] ?? null,
    destaque: Boolean(row.destaque),
    vendorId: row.tenant_id,
    vendorName: row.nome_empresa || "Imobiliária Parceira",
  };
}

const BASE_QUERY = `
  SELECT ip.*, t.nome_empresa
  FROM imoveis_propriedades ip
  JOIN tenants t ON t.id = ip.tenant_id
  WHERE ip.status = 'disponivel'
    AND t.vende_no_praca_ai = true
`;

export async function listImoveis(filters: { finalidade?: string; tipo?: string; cidade?: string; valorMax?: number } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.finalidade) {
    params.push(filters.finalidade);
    conditions.push(`ip.finalidade = $${params.length}`);
  }
  if (filters.tipo) {
    params.push(filters.tipo);
    conditions.push(`ip.tipo = $${params.length}`);
  }
  if (filters.cidade) {
    params.push(filters.cidade);
    conditions.push(`ip.cidade ILIKE $${params.length}`);
  }
  if (filters.valorMax) {
    params.push(filters.valorMax);
    conditions.push(`ip.valor <= $${params.length}`);
  }

  const query = `${BASE_QUERY} ${conditions.length ? "AND " + conditions.join(" AND ") : ""} ORDER BY ip.destaque DESC, ip.created_at DESC`;
  const result = await vendorPool.query(query, params);
  return result.rows.map(mapImovelRow);
}

export async function getImovelById(id: string) {
  const result = await vendorPool.query(`${BASE_QUERY} AND ip.id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return mapImovelRow(result.rows[0]);
}
