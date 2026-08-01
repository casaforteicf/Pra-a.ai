import { vendorPool } from "./vendorDb";

/**
 * Veículos vivem numa tabela própria do Vendor.ai (veiculos_estoque), não
 * em produtos_catalogo — precisam de campo/regra específica (vistoria
 * obrigatória, test-drive em vez de "adicionar ao carrinho"). Esse serviço
 * é o equivalente do catalogService.ts, mas pra esse segmento.
 */

export function mapVeiculoRow(row: any) {
  const fotos: string[] = Array.isArray(row.fotos) ? row.fotos : [];
  const precoBase = Number(row.valor ?? 0);
  const precoPromocional = row.valor_promocional != null ? Number(row.valor_promocional) : null;

  return {
    id: row.id,
    marca: row.marca,
    modelo: row.modelo,
    anoFabricacao: row.ano_fabricacao,
    anoModelo: row.ano_modelo,
    cor: row.cor,
    km: row.km,
    combustivel: row.combustivel,
    cambio: row.cambio,
    preco: precoPromocional ?? precoBase,
    precoOriginal: precoPromocional ? precoBase : null,
    descricao: row.descricao,
    fotos,
    imageUrl: fotos[0] ?? null,
    destaque: Boolean(row.destaque),
    vendorId: row.tenant_id,
    vendorName: row.nome_empresa || "Loja Parceira",
    vistoriaLaudoUrl: row.vistoria_laudo_url,
  };
}

const BASE_QUERY = `
  SELECT ve.*, t.nome_empresa
  FROM veiculos_estoque ve
  JOIN tenants t ON t.id = ve.tenant_id
  WHERE ve.status = 'disponivel'
    AND ve.vistoria_realizada = true
    AND ve.vende_no_praca_ai = true
    AND t.vende_no_praca_ai = true
`;

export async function listVeiculos(filters: { marca?: string; precoMax?: number } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.marca) {
    params.push(filters.marca);
    conditions.push(`ve.marca ILIKE $${params.length}`);
  }
  if (filters.precoMax) {
    params.push(filters.precoMax);
    conditions.push(`ve.valor <= $${params.length}`);
  }

  const query = `${BASE_QUERY} ${conditions.length ? "AND " + conditions.join(" AND ") : ""} ORDER BY ve.destaque DESC, ve.created_at DESC`;
  const result = await vendorPool.query(query, params);
  return result.rows.map(mapVeiculoRow);
}

export async function getVeiculoById(id: string) {
  const result = await vendorPool.query(`${BASE_QUERY} AND ve.id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return mapVeiculoRow(result.rows[0]);
}
