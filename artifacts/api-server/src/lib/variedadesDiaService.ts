import { vendorPool } from "./vendorDb";

export interface VariedadeDiaItem {
  id: string;
  categoria: string;
  titulo: string;
  conteudoTexto: string | null;
  videoUrl: string | null;
  imagemUrl: string | null;
  promocaoTipo: "produto" | "texto_livre" | null;
  promocaoProdutoId: string | null;
  promocaoProdutoNome: string | null;
  promocaoDescontoPercentual: string | null;
  promocaoTexto: string | null;
  expiresAt: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
}

// Conteúdo real de hoje (texto/vídeo + promoção opcional) publicado por
// parceiros — 1 por categoria por dia, expira sozinho em 24h. Substitui o
// carrossel fixo que existia antes (4 textos que giravam por dia da
// semana, sem lojista nenhum por trás).
export async function getVariedadesDeHoje(): Promise<VariedadeDiaItem[]> {
  const result = await vendorPool.query(
    `SELECT
       vd.id, vd.categoria, vd.titulo, vd.conteudo_texto, vd.video_url, vd.imagem_url,
       vd.promocao_tipo, vd.promocao_produto_id, vd.promocao_desconto_percentual, vd.promocao_texto,
       vd.expires_at,
       t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug,
       pc.nome AS promocao_produto_nome
     FROM variedades_dia vd
     JOIN tenants t ON t.id = vd.tenant_id
     LEFT JOIN produtos_catalogo pc ON pc.id = vd.promocao_produto_id
     WHERE vd.ativo = true
       AND vd.expires_at > now()
       AND t.vende_no_praca_ai = true
     ORDER BY vd.created_at DESC`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    categoria: row.categoria,
    titulo: row.titulo,
    conteudoTexto: row.conteudo_texto,
    videoUrl: row.video_url,
    imagemUrl: row.imagem_url,
    promocaoTipo: row.promocao_tipo,
    promocaoProdutoId: row.promocao_produto_id,
    promocaoProdutoNome: row.promocao_produto_nome,
    promocaoDescontoPercentual: row.promocao_desconto_percentual,
    promocaoTexto: row.promocao_texto,
    expiresAt: row.expires_at,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    tenantSlug: row.tenant_slug,
  }));
}

export async function getVariedadesPorCategoria(categoria: string): Promise<VariedadeDiaItem[]> {
  const todas = await getVariedadesDeHoje();
  return todas.filter((v) => v.categoria === categoria);
}
