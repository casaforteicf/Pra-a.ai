import { vendorPool } from "./vendorDb";

/**
 * Frete não é catálogo (não tem "produto" pra listar) — é cotação sob
 * demanda. O cliente final escolhe só o TIPO de veículo que precisa (igual
 * ao fluxo de compatibilidade veicular) — nunca uma empresa específica; o
 * sistema escolhe um transportador disponível pra esse tipo automaticamente,
 * balanceando pela carga ativa mais leve. A cotação em si vira uma "carga"
 * com status cotacao_pendente até o transportador responder o valor.
 */

export async function listTiposVeiculoDisponiveis() {
  const result = await vendorPool.query(`
    SELECT DISTINCT fv.tipo
    FROM fretes_veiculos fv
    JOIN tenants t ON t.id = fv.tenant_id
    WHERE fv.ativo = true AND t.vende_no_praca_ai = true
    ORDER BY fv.tipo ASC
  `);
  return result.rows.map((r) => r.tipo as string);
}

// Entre os transportadores com veículo ativo do tipo pedido, escolhe o que
// tem menos cargas em andamento agora — balanceamento simples, sem fila
// separada por empresa.
export async function escolherPrestadorPorTipoVeiculo(tipoVeiculo: string): Promise<{ vendorId: string; vendorName: string } | null> {
  const result = await vendorPool.query(
    `
    SELECT t.id, t.nome_empresa,
      (SELECT count(*) FROM fretes_cargas fc
       WHERE fc.tenant_id = t.id AND fc.status NOT IN ('entregue', 'cancelado')) AS carga_ativa
    FROM (SELECT DISTINCT tenant_id FROM fretes_veiculos WHERE ativo = true AND tipo = $1) fv
    JOIN tenants t ON t.id = fv.tenant_id
    WHERE t.vende_no_praca_ai = true
    ORDER BY carga_ativa ASC
    LIMIT 1
    `,
    [tipoVeiculo],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { vendorId: row.id, vendorName: row.nome_empresa };
}

