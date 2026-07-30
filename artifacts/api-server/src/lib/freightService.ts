import { vendorPool } from "./vendorDb";

/**
 * Frete não é catálogo (não tem "produto" pra listar) — é cotação sob
 * demanda. Esse serviço lista só os PRESTADORES (tenants que oferecem
 * frete) pra escolha, e a cotação em si vira uma "carga" com status
 * cotacao_pendente até o prestador responder o valor.
 */

export async function listPrestadoresFrete() {
  const result = await vendorPool.query(
    `SELECT DISTINCT t.id, t.nome_empresa
     FROM fretes_veiculos fv
     JOIN tenants t ON t.id = fv.tenant_id
     WHERE fv.ativo = true AND t.vende_no_praca_ai = true
     ORDER BY t.nome_empresa ASC`,
  );
  return result.rows.map((r) => ({ vendorId: r.id, vendorName: r.nome_empresa }));
}

export async function getTenantNome(vendorId: string): Promise<string | null> {
  const result = await vendorPool.query(`SELECT nome_empresa FROM tenants WHERE id = $1 AND vende_no_praca_ai = true`, [vendorId]);
  return result.rows[0]?.nome_empresa ?? null;
}
