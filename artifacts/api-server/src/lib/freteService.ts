import { vendorPool } from "./vendorDb";

export interface FreteResultado {
  valor: number;
  motivo: "frete_gratis_progressivo" | "mesma_cidade" | "outra_cidade" | "loja_nao_encontrada";
  freteGratisAcimaDe?: number;
  aproximado?: boolean;
}

/**
 * Cálculo de frete real, mas aproximado: compara a cidade do endereço de
 * entrega com a cidade cadastrada do lojista (tenants.cidade). Sem chave de
 * geolocalização (Google Maps/Mapbox), não dá pra calcular distância exata
 * em km — isso é um TODO explícito, não uma limitação escondida.
 */
export async function calcularFrete(vendorId: string, cidadeCliente: string | undefined, subtotalVendor: number, estadoCliente?: string): Promise<FreteResultado> {
  const result = await vendorPool.query(
    `SELECT cidade AS tenant_cidade, estado AS tenant_estado, frete_mesma_cidade, frete_outra_cidade, frete_gratis_acima_de
     FROM tenants WHERE id = $1 AND vende_no_praca_ai = true`,
    [vendorId],
  );

  if (result.rows.length === 0) {
    throw new Error("Loja indisponível para calcular o frete.");
  }

  const { tenant_cidade, tenant_estado, frete_mesma_cidade, frete_outra_cidade, frete_gratis_acima_de } = result.rows[0];
  const freteGratisAcimaDe = frete_gratis_acima_de == null ? null : Number(frete_gratis_acima_de);

  if (freteGratisAcimaDe !== null && subtotalVendor >= freteGratisAcimaDe) {
    return { valor: 0, motivo: "frete_gratis_progressivo", freteGratisAcimaDe };
  }

  const mesmaCidade =
    estadoCliente && tenant_estado && estadoCliente.trim().toUpperCase() === String(tenant_estado).trim().toUpperCase() && cidadeCliente && tenant_cidade && cidadeCliente.trim().toLowerCase() === String(tenant_cidade).trim().toLowerCase();

  const configured = mesmaCidade ? frete_mesma_cidade : frete_outra_cidade;
  if (configured == null || !Number.isFinite(Number(configured)) || Number(configured) < 0) throw new Error("Frete ainda não definido pelo vendedor.");
  const valor = Number(configured);

  return {
    valor,
    motivo: mesmaCidade ? "mesma_cidade" : "outra_cidade",
    ...(freteGratisAcimaDe === null ? {} : { freteGratisAcimaDe }),
    aproximado: true,
  };
}
