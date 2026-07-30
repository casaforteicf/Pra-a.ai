import { vendorPool } from "./vendorDb";

export function mapFarmaciaProdutoRow(row: any) {
  const precoVenda = Number(row.preco_venda ?? 0);
  const precoPromocional = row.preco_promocional != null ? Number(row.preco_promocional) : null;

  return {
    id: row.id,
    nome: row.nome,
    principioAtivo: row.principio_ativo,
    descricao: row.descricao,
    categoria: row.categoria,
    exigeReceita: Boolean(row.exige_receita),
    unidade: row.unidade,
    preco: precoPromocional ?? precoVenda,
    precoOriginal: precoPromocional ? precoVenda : null,
    estoque: row.estoque,
    imageUrl: row.imagem_url,
    vendorId: row.tenant_id,
    vendorName: row.nome_empresa || "Farmácia Parceira",
  };
}

const BASE_QUERY = `
  SELECT fp.*, t.nome_empresa
  FROM farmacia_produtos fp
  JOIN tenants t ON t.id = fp.tenant_id
  WHERE fp.ativo = true
    AND fp.estoque > 0
    AND t.vende_no_praca_ai = true
`;

export async function listFarmaciaProdutos(filters: { categoria?: string; nome?: string } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.categoria) {
    params.push(filters.categoria);
    conditions.push(`fp.categoria = $${params.length}`);
  }
  if (filters.nome) {
    params.push(`%${filters.nome}%`);
    conditions.push(`fp.nome ILIKE $${params.length}`);
  }

  const query = `${BASE_QUERY} ${conditions.length ? "AND " + conditions.join(" AND ") : ""} ORDER BY fp.destaque_whatsapp DESC, fp.nome ASC`;
  const result = await vendorPool.query(query, params);
  return result.rows.map(mapFarmaciaProdutoRow);
}

export async function getFarmaciaProdutoById(id: string) {
  const result = await vendorPool.query(`${BASE_QUERY} AND fp.id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return mapFarmaciaProdutoRow(result.rows[0]);
}
