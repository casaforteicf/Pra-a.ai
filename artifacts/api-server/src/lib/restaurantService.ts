import { vendorPool } from "./vendorDb";

export function mapCardapioItemRow(row: any) {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    categoria: row.categoria,
    preco: Number(row.preco ?? 0),
    tempoPreparoMinutos: row.tempo_preparo_minutos,
    disponivelAlmoco: Boolean(row.disponivel_almoco),
    disponivelJantar: Boolean(row.disponivel_jantar),
    imageUrl: row.imagem_url,
    vendorId: row.tenant_id,
    vendorName: row.nome_empresa || "Restaurante Parceiro",
  };
}

const BASE_QUERY = `
  SELECT rc.*, t.nome_empresa
  FROM restaurante_cardapio rc
  JOIN tenants t ON t.id = rc.tenant_id
  WHERE rc.ativo = true
    AND t.vende_no_praca_ai = true
`;

export async function listCardapio(filters: { vendorId?: string; categoria?: string } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.vendorId) {
    params.push(filters.vendorId);
    conditions.push(`rc.tenant_id = $${params.length}`);
  }
  if (filters.categoria) {
    params.push(filters.categoria);
    conditions.push(`rc.categoria = $${params.length}`);
  }

  const query = `${BASE_QUERY} ${conditions.length ? "AND " + conditions.join(" AND ") : ""} ORDER BY t.nome_empresa ASC, rc.categoria ASC`;
  const result = await vendorPool.query(query, params);
  return result.rows.map(mapCardapioItemRow);
}

export async function getCardapioItemById(id: string) {
  const result = await vendorPool.query(`${BASE_QUERY} AND rc.id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return mapCardapioItemRow(result.rows[0]);
}

export async function listRestaurantes(filters: { categoria?: string } = {}) {
  const params: unknown[] = [];
  let categoriaFilter = "";
  if (filters.categoria) {
    params.push(`%${filters.categoria}%`);
    categoriaFilter = `AND EXISTS (SELECT 1 FROM restaurante_cardapio rc3 WHERE rc3.tenant_id = t.id AND rc3.ativo = true AND rc3.categoria ILIKE $${params.length})`;
  }
  const result = await vendorPool.query(
    `SELECT DISTINCT t.id, t.nome_empresa,
       (SELECT array_agg(DISTINCT rc2.categoria) FROM restaurante_cardapio rc2 WHERE rc2.tenant_id = t.id AND rc2.ativo = true AND rc2.categoria IS NOT NULL) AS categorias
     FROM restaurante_cardapio rc
     JOIN tenants t ON t.id = rc.tenant_id
     WHERE rc.ativo = true AND t.vende_no_praca_ai = true ${categoriaFilter}
     ORDER BY t.nome_empresa ASC`,
    params,
  );
  return result.rows.map((r) => ({ vendorId: r.id, vendorName: r.nome_empresa, categorias: r.categorias ?? [] }));
}
