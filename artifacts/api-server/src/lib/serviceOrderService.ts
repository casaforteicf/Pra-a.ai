import { vendorPool } from "./vendorDb";

export function mapServicoTipoRow(row: any) {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    especialidade: row.especialidade,
    precoBase: row.preco_base != null ? Number(row.preco_base) : null,
    requerVisitaTecnica: Boolean(row.requer_visita_tecnica),
    vendorId: row.tenant_id,
    vendorName: row.nome_empresa || "Prestador Parceiro",
  };
}

const BASE_QUERY = `
  SELECT st.*, t.nome_empresa
  FROM servicos_tipos st
  JOIN tenants t ON t.id = st.tenant_id
  WHERE st.ativo = true
    AND t.vende_no_praca_ai = true
`;

export async function listServicosTipos(filters: { especialidade?: string } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.especialidade) {
    params.push(filters.especialidade);
    conditions.push(`st.especialidade = $${params.length}`);
  }

  const query = `${BASE_QUERY} ${conditions.length ? "AND " + conditions.join(" AND ") : ""} ORDER BY st.nome ASC`;
  const result = await vendorPool.query(query, params);
  return result.rows.map(mapServicoTipoRow);
}

export async function getServicoTipoById(id: string) {
  const result = await vendorPool.query(`${BASE_QUERY} AND st.id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return mapServicoTipoRow(result.rows[0]);
}
