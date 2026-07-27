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
export async function calcularFrete(vendorId: string, cidadeCliente: string | undefined, subtotalVendor: number): Promise<FreteResultado> {
  const result = await vendorPool.query(
    `SELECT cidade AS tenant_cidade, frete_mesma_cidade, frete_outra_cidade, frete_gratis_acima_de
     FROM tenants WHERE id = $1 AND vende_no_praca_ai = true`,
    [vendorId],
  );

  if (result.rows.length === 0) {
    return { valor: 0, motivo: "loja_nao_encontrada" };
  }

  const { tenant_cidade, frete_mesma_cidade, frete_outra_cidade, frete_gratis_acima_de } = result.rows[0];
  const freteGratisAcimaDe = Number(frete_gratis_acima_de ?? 79);

  if (subtotalVendor >= freteGratisAcimaDe) {
    return { valor: 0, motivo: "frete_gratis_progressivo", freteGratisAcimaDe };
  }

  const mesmaCidade =
    cidadeCliente && tenant_cidade && cidadeCliente.trim().toLowerCase() === String(tenant_cidade).trim().toLowerCase();

  const valor = mesmaCidade ? Number(frete_mesma_cidade ?? 0) : Number(frete_outra_cidade ?? 15.9);

  return {
    valor,
    motivo: mesmaCidade ? "mesma_cidade" : "outra_cidade",
    freteGratisAcimaDe,
    aproximado: true,
  };
}
