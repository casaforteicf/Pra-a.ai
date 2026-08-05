/**
 * Revenue Scout — Lado Comprador (Praça.ai).
 *
 * Cobre 6 mecanismos com dado real e lógica de verdade (não stub). Os
 * outros estão documentados no final deste arquivo com o que falta de
 * schema pra existirem — nenhum foi implementado com dado falso.
 *
 * IMPORTANTE: esse motor decide QUEM recebe QUAL mensagem (gera a
 * oportunidade). Ele NÃO ENVIA nada — não existe canal de push/SMS/
 * e-mail genérico no Praça.ai hoje (só WhatsApp, só pra farmácia).
 */
import { and, eq, gte, lt, sql } from "drizzle-orm";
import {
  db,
  cartsTable,
  cartItemsTable,
  ordersTable,
  scoutPraRegrasTable,
  scoutPraOportunidadesTable,
  scoutPraEnviosLogTable,
  favoritesTable,
  productViewsTable,
  searchLogsTable,
  consumerCouponsTable,
  campanhasTable,
  consumerBeneficiosTable,
  assinaturasTable,
  npsRespostasTable,
  consumersTable,
  type ScoutPraRegra,
} from "@workspace/db";
import { vendorPool } from "./vendorDb";
import type { Logger } from "pino";

const DAY_MS = 1000 * 60 * 60 * 24;

const VENDOR_API_BASE_URL = process.env.VENDOR_API_BASE_URL || "https://appvendorai.com/api";
const PRACA_AI_INTERNAL_KEY = process.env.PRACA_AI_INTERNAL_KEY || "";

/**
 * Ponte pro Scout do Vendor.ai — pra oportunidades com produtoId,
 * resolve o vendedor (tenant) do produto e o lead do consumidor nesse
 * vendedor, e manda o sinal. Melhor esforço: nunca lança, nunca atrasa
 * a criação da oportunidade no Praça.ai por causa disso.
 */
async function alinharComVendorAi(input: {
  consumerId: number;
  produtoId?: string;
  tipo: string;
  descricao: string;
  canal: string;
  score: number;
  log?: Logger;
}): Promise<void> {
  if (!input.produtoId || !PRACA_AI_INTERNAL_KEY) return;
  try {
    const { rows: produtoRows } = await vendorPool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM produtos_catalogo WHERE id = $1`,
      [input.produtoId],
    );
    const tenantId = produtoRows[0]?.tenant_id;
    if (!tenantId) return;

    const [consumer] = await db.select().from(consumersTable).where(eq(consumersTable.id, input.consumerId));
    if (!consumer) return;

    const { findOrCreateLead } = await import("./vendorSyncService");
    const leadId = await findOrCreateLead(tenantId, { nome: consumer.name, telefone: consumer.phone ?? null, email: consumer.email, endereco: null });

    await fetch(`${VENDOR_API_BASE_URL}/internal/scout/consumer-signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": PRACA_AI_INTERNAL_KEY },
      body: JSON.stringify({ leadId, tenantId, tipo: input.tipo, descricao: input.descricao, canal: input.canal, scoreOportunidade: input.score }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    input.log?.warn({ err, produtoId: input.produtoId }, "scout-pra: falha ao alinhar com Vendor.ai (não bloqueia)");
  }
}

const LIMITES_POR_CANAL: Record<string, { quantidade: number; janelaDias: number }> = {
  push: { quantidade: 1, janelaDias: 1 },
  sms: { quantidade: 2, janelaDias: 7 },
  email: { quantidade: 2, janelaDias: 7 },
  app: { quantidade: 3, janelaDias: 1 },
};

async function podeReceberNoCanal(consumerId: number, canal: string): Promise<boolean> {
  const limite = LIMITES_POR_CANAL[canal] ?? { quantidade: 1, janelaDias: 1 };
  const desde = new Date(Date.now() - limite.janelaDias * DAY_MS);
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(scoutPraEnviosLogTable)
    .where(and(eq(scoutPraEnviosLogTable.consumerId, consumerId), eq(scoutPraEnviosLogTable.canal, canal), gte(scoutPraEnviosLogTable.enviadoEm, desde)));
  return (row?.total ?? 0) < limite.quantidade;
}

async function jaConverteuHoje(consumerId: number): Promise<boolean> {
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(ordersTable)
    .where(and(eq(ordersTable.consumerId, consumerId), gte(ordersTable.createdAt, inicioDoDia)));
  return (row?.total ?? 0) > 0;
}

async function jaTemOportunidadePendente(regraId: string, consumerId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: scoutPraOportunidadesTable.id })
    .from(scoutPraOportunidadesTable)
    .where(and(eq(scoutPraOportunidadesTable.regraId, regraId), eq(scoutPraOportunidadesTable.consumerId, consumerId), eq(scoutPraOportunidadesTable.status, "pendente")))
    .limit(1);
  return !!row;
}

interface CriarOportunidadeInput {
  regra: ScoutPraRegra;
  consumerId: number;
  descricao: string;
  mensagem: string;
  produtoId?: string;
  score: number;
  receitaEsperada?: number;
  log?: Logger;
}

async function criarOportunidade(input: CriarOportunidadeInput): Promise<void> {
  const { regra, consumerId, descricao, mensagem, produtoId, score, receitaEsperada, log } = input;
  if (await jaConverteuHoje(consumerId)) return;
  if (await jaTemOportunidadePendente(regra.id, consumerId)) return;
  if (!(await podeReceberNoCanal(consumerId, regra.canal))) return;

  try {
    await db.insert(scoutPraOportunidadesTable).values({
      regraId: regra.id,
      consumerId,
      tipo: regra.tipo,
      descricao,
      mensagem,
      canal: regra.canal,
      produtoId,
      scoreOportunidade: String(score),
      receitaEsperada: receitaEsperada != null ? String(receitaEsperada) : undefined,
    });
  } catch (err) {
    log?.warn({ err, regraId: regra.id, consumerId }, "scout-pra: falha ao criar oportunidade");
    return;
  }

  void alinharComVendorAi({ consumerId, produtoId, tipo: regra.tipo, descricao, canal: regra.canal, score, log });
}

function preencherTemplate(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{{${k}}}`, String(v)), template);
}

// 1. Carrinho abandonado (3.4, #23-24) — funciona hoje, sem histórico
async function runCarrinhoAbandonado(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const minutosAbandono = Number(regra.condicoes["minutosAbandono"] ?? 60);
  const limite = new Date(Date.now() - minutosAbandono * 60 * 1000);

  const carrinhos = await db
    .select({ id: cartsTable.id, consumerId: cartsTable.consumerId, updatedAt: cartsTable.updatedAt })
    .from(cartsTable)
    .where(and(lt(cartsTable.updatedAt, limite), sql`${cartsTable.consumerId} IS NOT NULL`));

  let criadas = 0;
  for (const carrinho of carrinhos) {
    if (!carrinho.consumerId) continue;
    const itens = await db.select().from(cartItemsTable).where(eq(cartItemsTable.cartId, carrinho.id));
    if (itens.length === 0) continue;

    const valorTotal = itens.reduce((soma: number, i: typeof itens[number]) => soma + Number(i.productPrice) * i.quantity, 0);
    const primeiroItem = itens[0]!;
    const mensagem = preencherTemplate(regra.mensagemTemplate, { produto: primeiroItem.productName, valor: valorTotal.toFixed(2) });

    await criarOportunidade({
      regra,
      consumerId: carrinho.consumerId,
      descricao: `Carrinho abandonado há ${minutosAbandono}+ min — ${itens.length} item(ns), R$ ${valorTotal.toFixed(2)}`,
      mensagem,
      produtoId: primeiroItem.productId,
      score: valorTotal > 500 ? 90 : valorTotal > 150 ? 75 : 60,
      receitaEsperada: valorTotal * 0.12,
      log,
    });
    criadas += 1;
  }
  return criadas;
}

// 2. Estoque baixo (3.5, #28) — só funciona onde estoqueQuantidade é
// preenchido de verdade (Veículos, Varejo com grade, Farmácia, Pacotes)
async function runEstoqueBaixo(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const limiteUnidades = Number(regra.condicoes["limiteUnidades"] ?? 5);

  const { rows } = await vendorPool.query<{ id: string; nome: string; estoque_quantidade: number }>(
    `SELECT id, nome, estoque_quantidade FROM produtos_catalogo
     WHERE ativo = true AND controla_estoque = true
       AND estoque_quantidade IS NOT NULL AND estoque_quantidade > 0 AND estoque_quantidade <= $1
     LIMIT 200`,
    [limiteUnidades],
  );

  let criadas = 0;
  for (const produto of rows) {
    const interessados = await db.execute(sql`SELECT consumer_id FROM favorites WHERE product_id = ${produto.id} LIMIT 500`);
    for (const row of interessados.rows as unknown as { consumer_id: number }[]) {
      const mensagem = preencherTemplate(regra.mensagemTemplate, { produto: produto.nome, unidades: produto.estoque_quantidade });
      await criarOportunidade({
        regra,
        consumerId: row.consumer_id,
        descricao: `${produto.nome} — restam só ${produto.estoque_quantidade} unidades, cliente já favoritou`,
        mensagem,
        produtoId: produto.id,
        score: 85,
        log,
      });
      criadas += 1;
    }
  }
  return criadas;
}

// 3. Recompra programada (3.1, #1-8) — precisa de 2+ compras do mesmo
// produto pelo mesmo consumidor pra detectar ciclo. Chapecó com 0
// pedidos hoje: não encontra ninguém ainda, lógica pronta.
async function runRecompraProgramada(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const diasAntesDoFim = Number(regra.condicoes["diasAntesDoFim"] ?? 3);

  const historico = await db.execute(sql`
    SELECT
      o.consumer_id, oi.product_id, oi.product_name,
      count(*)::int AS compras,
      max(o.created_at) AS ultima_compra,
      EXTRACT(EPOCH FROM (max(o.created_at) - min(o.created_at))) / 86400.0 / NULLIF(count(*) - 1, 0) AS ciclo_medio_dias
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.consumer_id IS NOT NULL AND o.status NOT IN ('cancelled', 'refunded')
    GROUP BY o.consumer_id, oi.product_id, oi.product_name
    HAVING count(*) >= 2
  `);

  let criadas = 0;
  for (const linha of historico.rows as unknown as { consumer_id: number; product_id: string; product_name: string; compras: number; ultima_compra: Date; ciclo_medio_dias: number }[]) {
    if (!linha.ciclo_medio_dias || linha.ciclo_medio_dias <= 0) continue;
    const diasDesdeUltima = (Date.now() - new Date(linha.ultima_compra).getTime()) / DAY_MS;
    const diasParaProxima = linha.ciclo_medio_dias - diasDesdeUltima;
    if (diasParaProxima > diasAntesDoFim || diasParaProxima < -linha.ciclo_medio_dias) continue;

    const mensagem = preencherTemplate(regra.mensagemTemplate, { produto: linha.product_name });
    await criarOportunidade({
      regra,
      consumerId: linha.consumer_id,
      descricao: `${linha.product_name} — ciclo de ${linha.ciclo_medio_dias.toFixed(0)}d, ${diasDesdeUltima.toFixed(0)}d desde a última compra`,
      mensagem,
      produtoId: linha.product_id,
      score: Math.min(60 + linha.compras * 5, 95),
      log,
    });
    criadas += 1;
  }
  return criadas;
}

// 4. Reativação de inativos (3.9, #46-48)
async function runReativacaoInativo(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const diasInatividade = Number(regra.condicoes["diasInatividade"] ?? 60);
  const limite = new Date(Date.now() - diasInatividade * DAY_MS);

  const inativos = await db.execute(sql`
    SELECT consumer_id, max(created_at) AS ultima_compra, avg(total::numeric) AS ticket_medio
    FROM orders
    WHERE consumer_id IS NOT NULL AND status NOT IN ('cancelled', 'refunded')
    GROUP BY consumer_id
    HAVING max(created_at) < ${limite}
  `);

  let criadas = 0;
  for (const linha of inativos.rows as unknown as { consumer_id: number; ultima_compra: Date; ticket_medio: number }[]) {
    const diasSemComprar = Math.floor((Date.now() - new Date(linha.ultima_compra).getTime()) / DAY_MS);
    const mensagem = preencherTemplate(regra.mensagemTemplate, { dias: diasSemComprar });
    await criarOportunidade({
      regra,
      consumerId: linha.consumer_id,
      descricao: `Inativo há ${diasSemComprar} dias — ticket médio R$ ${Number(linha.ticket_medio).toFixed(2)}`,
      mensagem,
      score: diasSemComprar > 180 ? 90 : diasSemComprar > 90 ? 75 : 60,
      receitaEsperada: Number(linha.ticket_medio) * 0.12,
      log,
    });
    criadas += 1;
  }
  return criadas;
}

// 5. Milestone de compras (3.10, #52)
async function runMilestoneCompras(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const marco = Number(regra.condicoes["numeroCompras"] ?? 10);
  const consumidores = await db.execute(sql`
    SELECT consumer_id, count(*)::int AS total FROM orders
    WHERE consumer_id IS NOT NULL AND status NOT IN ('cancelled', 'refunded')
    GROUP BY consumer_id HAVING count(*) = ${marco}
  `);

  let criadas = 0;
  for (const linha of consumidores.rows as unknown as { consumer_id: number; total: number }[]) {
    const mensagem = preencherTemplate(regra.mensagemTemplate, { marco });
    await criarOportunidade({ regra, consumerId: linha.consumer_id, descricao: `Completou ${marco} compras`, mensagem, score: 70, log });
    criadas += 1;
  }
  return criadas;
}

// 6. Pós-compra sem avaliação (3.12, #59-60)
async function runPosCompraAvaliacao(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const diasAposEntrega = Number(regra.condicoes["diasAposEntrega"] ?? 7);
  const limite = new Date(Date.now() - diasAposEntrega * DAY_MS);

  const pedidosSemAvaliacao = await db.execute(sql`
    SELECT o.consumer_id, oi.product_id, oi.product_name
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.consumer_id IS NOT NULL AND o.status = 'delivered' AND o.updated_at <= ${limite}
      AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.consumer_id = o.consumer_id AND r.product_id = oi.product_id)
    LIMIT 300
  `);

  let criadas = 0;
  for (const linha of pedidosSemAvaliacao.rows as unknown as { consumer_id: number; product_id: string; product_name: string }[]) {
    const mensagem = preencherTemplate(regra.mensagemTemplate, { produto: linha.product_name });
    await criarOportunidade({
      regra,
      consumerId: linha.consumer_id,
      descricao: `${linha.product_name} entregue há ${diasAposEntrega}+ dias, sem avaliação`,
      mensagem,
      produtoId: linha.product_id,
      score: 40,
      log,
    });
    criadas += 1;
  }
  return criadas;
}

// 7. Favorito com preço caindo (#27)
async function runFavoritoPrecoCaiu(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const percentualMinimo = Number(regra.condicoes["percentualMinimoQueda"] ?? 10);
  const favoritosComPreco = await db.select().from(favoritesTable).where(sql`${favoritesTable.precoNoFavorito} IS NOT NULL`);
  if (favoritosComPreco.length === 0) return 0;

  const ids = favoritosComPreco.map((f: typeof favoritosComPreco[number]) => f.productId);
  const { rows: precosAtuais } = await vendorPool.query<{ id: string; nome: string; preco_base: string }>(
    `SELECT id, nome, preco_base FROM produtos_catalogo WHERE id = ANY($1)`,
    [ids],
  );
  const precoPorId = new Map(precosAtuais.map((p) => [p.id, p]));

  let criadas = 0;
  for (const fav of favoritosComPreco) {
    const atual = precoPorId.get(fav.productId);
    if (!atual || !fav.precoNoFavorito) continue;
    const precoAntigo = Number(fav.precoNoFavorito);
    const precoNovo = Number(atual.preco_base);
    const quedaPercentual = ((precoAntigo - precoNovo) / precoAntigo) * 100;
    if (quedaPercentual < percentualMinimo) continue;

    const mensagem = preencherTemplate(regra.mensagemTemplate, { produto: atual.nome, percentual: quedaPercentual.toFixed(0) });
    await criarOportunidade({
      regra,
      consumerId: fav.consumerId,
      descricao: `${atual.nome} favoritado caiu ${quedaPercentual.toFixed(0)}% (R$ ${precoAntigo.toFixed(2)} para R$ ${precoNovo.toFixed(2)})`,
      mensagem,
      produtoId: fav.productId,
      score: Math.min(60 + quedaPercentual, 95),
      log,
    });
    criadas += 1;
  }
  return criadas;
}

// 8. Aniversário (#50-51)
async function runAniversario(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const hoje = new Date();
  const mesDia = `${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

  const aniversariantes = await db
    .select({ id: consumersTable.id, name: consumersTable.name })
    .from(consumersTable)
    .where(sql`${consumersTable.dataNascimento} IS NOT NULL AND to_char(${consumersTable.dataNascimento}::date, 'MM-DD') = ${mesDia}`);

  let criadas = 0;
  for (const consumidor of aniversariantes) {
    const mensagem = preencherTemplate(regra.mensagemTemplate, { nome: consumidor.name });
    await criarOportunidade({ regra, consumerId: consumidor.id, descricao: `Aniversario de ${consumidor.name} hoje`, mensagem, score: 80, log });
    criadas += 1;
  }
  return criadas;
}

// 9. Pontos expirando (#39)
async function runPontosExpirando(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const diasAntes = Number(regra.condicoes["diasAntesVencimento"] ?? 30);
  const limite = new Date(Date.now() + diasAntes * DAY_MS);

  const expirando = await db.execute(sql`
    SELECT consumer_id, sum(quantidade)::int AS pontos_expirando
    FROM coin_transactions
    WHERE tipo = 'ganho' AND expira_em IS NOT NULL AND expira_em <= ${limite} AND expira_em > now()
    GROUP BY consumer_id
  `);

  let criadas = 0;
  for (const linha of expirando.rows as unknown as { consumer_id: number; pontos_expirando: number }[]) {
    const mensagem = preencherTemplate(regra.mensagemTemplate, { pontos: linha.pontos_expirando });
    await criarOportunidade({ regra, consumerId: linha.consumer_id, descricao: `${linha.pontos_expirando} pontos expirando em ate ${diasAntes} dias`, mensagem, score: 65, log });
    criadas += 1;
  }
  return criadas;
}

// 10. Cross-sell pos-compra (#9-16) — pares configurados em
// condicoes.pares [{origemId, sugeridoId}]
async function runCrossSell(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const pares = (regra.condicoes["pares"] as Array<{ origemId: string; sugeridoId: string }> | undefined) ?? [];
  const diasApos = Number(regra.condicoes["diasApos"] ?? 1);
  if (pares.length === 0) return 0;

  let criadas = 0;
  for (const par of pares) {
    const compradores = await db.execute(sql`
      SELECT DISTINCT o.consumer_id
      FROM orders o JOIN order_items oi ON oi.order_id = o.id
      WHERE oi.product_id = ${par.origemId} AND o.consumer_id IS NOT NULL
        AND o.created_at <= now() - (${diasApos} || ' days')::interval
        AND NOT EXISTS (
          SELECT 1 FROM order_items oi2 JOIN orders o2 ON o2.id = oi2.order_id
          WHERE o2.consumer_id = o.consumer_id AND oi2.product_id = ${par.sugeridoId}
        )
    `);
    const { rows: produtoSugerido } = await vendorPool.query<{ nome: string }>(`SELECT nome FROM produtos_catalogo WHERE id = $1`, [par.sugeridoId]);
    const nomeSugerido = produtoSugerido[0]?.nome ?? "produto complementar";

    for (const linha of compradores.rows as unknown as { consumer_id: number }[]) {
      const mensagem = preencherTemplate(regra.mensagemTemplate, { produto: nomeSugerido });
      await criarOportunidade({ regra, consumerId: linha.consumer_id, descricao: `Comprou item de origem, sugerir ${nomeSugerido}`, mensagem, produtoId: par.sugeridoId, score: 70, log });
      criadas += 1;
    }
  }
  return criadas;
}

// 11. Upsell (#17-22) e 12. Produto com nova versao (#61) — mesma query
// (usa produtoSucessorId no catalogo), mensagens diferentes por regra
async function runUpsell(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const diasApos = Number(regra.condicoes["diasApos"] ?? 7);
  const { rows: comSucessor } = await vendorPool.query<{ id: string; nome: string; produto_sucessor_id: string; sucessor_nome: string }>(`
    SELECT p.id, p.nome, p.produto_sucessor_id, s.nome AS sucessor_nome
    FROM produtos_catalogo p JOIN produtos_catalogo s ON s.id = p.produto_sucessor_id
    WHERE p.produto_sucessor_id IS NOT NULL AND s.ativo = true
  `);

  let criadas = 0;
  for (const produto of comSucessor) {
    const compradores = await db.execute(sql`
      SELECT DISTINCT o.consumer_id FROM orders o JOIN order_items oi ON oi.order_id = o.id
      WHERE oi.product_id = ${produto.id} AND o.consumer_id IS NOT NULL
        AND o.created_at <= now() - (${diasApos} || ' days')::interval
    `);
    for (const linha of compradores.rows as unknown as { consumer_id: number }[]) {
      const mensagem = preencherTemplate(regra.mensagemTemplate, { produtoAtual: produto.nome, produtoNovo: produto.sucessor_nome });
      await criarOportunidade({ regra, consumerId: linha.consumer_id, descricao: `${produto.nome} tem versao nova: ${produto.sucessor_nome}`, mensagem, produtoId: produto.produto_sucessor_id, score: 65, log });
      criadas += 1;
    }
  }
  return criadas;
}
const runProdutoNovaVersao = runUpsell;

// 13. Sazonalidade/evento (#32-37) — 1x/ano a partir do mes configurado
async function runSazonalidadeEvento(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const mesGatilho = Number(regra.condicoes["mesGatilho"] ?? new Date().getMonth() + 1);
  if (new Date().getMonth() + 1 !== mesGatilho) return 0;
  const categoria = regra.condicoes["categoria"] as string | undefined;
  if (!categoria) return 0;

  const { rows: produtosCategoria } = await vendorPool.query<{ id: string }>(
    `SELECT pc.id FROM produtos_catalogo pc JOIN categorias_produto cp ON cp.id = pc.categoria_id WHERE cp.nome = $1`,
    [categoria],
  );
  const produtoIds = produtosCategoria.map((p) => p.id);
  if (produtoIds.length === 0) return 0;

  const compradoresAnoPassado = await db.execute(sql`
    SELECT DISTINCT o.consumer_id FROM orders o JOIN order_items oi ON oi.order_id = o.id
    WHERE oi.product_id = ANY(${produtoIds}) AND o.consumer_id IS NOT NULL
      AND o.created_at BETWEEN now() - interval '13 months' AND now() - interval '10 months'
      AND NOT EXISTS (
        SELECT 1 FROM order_items oi2 JOIN orders o2 ON o2.id = oi2.order_id
        WHERE o2.consumer_id = o.consumer_id AND oi2.product_id = ANY(${produtoIds}) AND o2.created_at > now() - interval '10 months'
      )
  `);

  let criadas = 0;
  for (const linha of compradoresAnoPassado.rows as unknown as { consumer_id: number }[]) {
    const mensagem = preencherTemplate(regra.mensagemTemplate, { categoria });
    await criarOportunidade({ regra, consumerId: linha.consumer_id, descricao: `Comprou ${categoria} na temporada passada, ainda nao voltou`, mensagem, score: 68, log });
    criadas += 1;
  }
  return criadas;
}

// 14. NPS baixo (#54)
async function runNpsBaixo(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const notaMaxima = Number(regra.condicoes["notaMaxima"] ?? 6);
  const diasJanela = Number(regra.condicoes["diasJanela"] ?? 3);
  const limite = new Date(Date.now() - diasJanela * DAY_MS);

  const respostas = await db.select().from(npsRespostasTable)
    .where(and(sql`${npsRespostasTable.nota} <= ${notaMaxima}`, gte(npsRespostasTable.createdAt, limite)));

  let criadas = 0;
  for (const resposta of respostas) {
    const mensagem = preencherTemplate(regra.mensagemTemplate, { nota: resposta.nota });
    await criarOportunidade({ regra, consumerId: resposta.consumerId, descricao: `NPS ${resposta.nota} — risco de churn`, mensagem, score: 75, log });
    criadas += 1;
  }
  return criadas;
}

// 15. Navegacao intensa (#25)
async function runNavegacaoIntensa(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const minimoVisualizacoes = Number(regra.condicoes["minimoVisualizacoes"] ?? 3);
  const diasJanela = Number(regra.condicoes["diasJanela"] ?? 2);
  const limite = new Date(Date.now() - diasJanela * DAY_MS);

  const intensos = await db
    .select({ consumerId: productViewsTable.consumerId, productId: productViewsTable.productId, total: sql<number>`count(*)` })
    .from(productViewsTable)
    .where(and(gte(productViewsTable.createdAt, limite), sql`${productViewsTable.consumerId} IS NOT NULL`))
    .groupBy(productViewsTable.consumerId, productViewsTable.productId)
    .having(sql`count(*) >= ${minimoVisualizacoes}`);

  let criadas = 0;
  for (const linha of intensos) {
    if (!linha.consumerId) continue;
    const { rows } = await vendorPool.query<{ nome: string }>(`SELECT nome FROM produtos_catalogo WHERE id = $1`, [linha.productId]);
    const nome = rows[0]?.nome ?? "produto";
    const mensagem = preencherTemplate(regra.mensagemTemplate, { produto: nome });
    await criarOportunidade({ regra, consumerId: linha.consumerId, descricao: `Visualizou ${nome} ${linha.total}x em ${diasJanela} dias`, mensagem, produtoId: linha.productId, score: 72, log });
    criadas += 1;
  }
  return criadas;
}

// 16. Busca sem resultado (#26)
async function runBuscaSemResultado(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const diasJanela = Number(regra.condicoes["diasJanela"] ?? 3);
  const limite = new Date(Date.now() - diasJanela * DAY_MS);

  const buscas = await db.select().from(searchLogsTable)
    .where(and(eq(searchLogsTable.teveResultado, false), gte(searchLogsTable.createdAt, limite), sql`${searchLogsTable.consumerId} IS NOT NULL`));

  let criadas = 0;
  for (const busca of buscas) {
    if (!busca.consumerId) continue;
    const mensagem = preencherTemplate(regra.mensagemTemplate, { termo: busca.termo });
    await criarOportunidade({ regra, consumerId: busca.consumerId, descricao: `Buscou "${busca.termo}" sem resultado`, mensagem, score: 50, log });
    criadas += 1;
  }
  return criadas;
}

// 17. Cupom expirando (#31)
async function runCupomExpirando(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const horasAntes = Number(regra.condicoes["horasAntesVencimento"] ?? 3);
  const limite = new Date(Date.now() + horasAntes * 60 * 60 * 1000);

  const cupons = await db.select().from(consumerCouponsTable)
    .where(and(sql`${consumerCouponsTable.usadoEm} IS NULL`, lt(consumerCouponsTable.expiraEm, limite), gte(consumerCouponsTable.expiraEm, new Date())));

  let criadas = 0;
  for (const cupom of cupons) {
    const mensagem = preencherTemplate(regra.mensagemTemplate, { codigo: cupom.codigo });
    await criarOportunidade({ regra, consumerId: cupom.consumerId, descricao: `Cupom ${cupom.codigo} expira em ate ${horasAntes}h`, mensagem, score: 88, log });
    criadas += 1;
  }
  return criadas;
}

// 18. Promocao relampago / frete gratis por tempo limitado (#29-30)
async function runPromocaoRelampago(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const campanhasAtivas = await db.select().from(campanhasTable)
    .where(and(eq(campanhasTable.ativo, true), lt(campanhasTable.inicioEm, new Date()), gte(campanhasTable.fimEm, new Date())));
  if (campanhasAtivas.length === 0) return 0;

  const baseAtiva = await db.execute(sql`
    SELECT DISTINCT consumer_id FROM orders WHERE consumer_id IS NOT NULL AND created_at > now() - interval '90 days' LIMIT 5000
  `);

  let criadas = 0;
  for (const campanha of campanhasAtivas) {
    const mensagem = preencherTemplate(regra.mensagemTemplate, { campanha: campanha.nome });
    for (const linha of baseAtiva.rows as unknown as { consumer_id: number }[]) {
      await criarOportunidade({ regra, consumerId: linha.consumer_id, descricao: `Campanha "${campanha.nome}" ativa`, mensagem, score: 55, log });
      criadas += 1;
    }
  }
  return criadas;
}

// 19. Beneficio de fidelidade nao usado (#40)
async function runBeneficioNaoUsado(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const diasAntesVencer = Number(regra.condicoes["diasAntesVencer"] ?? 10);
  const limite = new Date(Date.now() + diasAntesVencer * DAY_MS);

  const beneficios = await db.select().from(consumerBeneficiosTable)
    .where(and(sql`${consumerBeneficiosTable.usadoEm} IS NULL`, sql`${consumerBeneficiosTable.expiraEm} IS NOT NULL`, lt(consumerBeneficiosTable.expiraEm, limite)));

  let criadas = 0;
  for (const beneficio of beneficios) {
    const mensagem = preencherTemplate(regra.mensagemTemplate, { beneficio: beneficio.descricao });
    await criarOportunidade({ regra, consumerId: beneficio.consumerId, descricao: `Beneficio "${beneficio.descricao}" parado, expira em breve`, mensagem, score: 60, log });
    criadas += 1;
  }
  return criadas;
}

// 20. Assinatura disponivel pra ativar (#38) — comprador frequente do
// mesmo produto que ainda nao tem assinatura dele
async function runAssinaturaDisponivel(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const minimoCompras = Number(regra.condicoes["minimoComprasParaSugerir"] ?? 3);

  const candidatos = await db.execute(sql`
    SELECT o.consumer_id, oi.product_id, oi.product_name, count(*)::int AS total
    FROM orders o JOIN order_items oi ON oi.order_id = o.id
    WHERE o.consumer_id IS NOT NULL
    GROUP BY o.consumer_id, oi.product_id, oi.product_name
    HAVING count(*) >= ${minimoCompras}
  `);

  let criadas = 0;
  for (const linha of candidatos.rows as unknown as { consumer_id: number; product_id: string; product_name: string; total: number }[]) {
    const [jaTem] = await db.select().from(assinaturasTable)
      .where(and(eq(assinaturasTable.consumerId, linha.consumer_id), eq(assinaturasTable.productId, linha.product_id), eq(assinaturasTable.status, "ativa")))
      .limit(1);
    if (jaTem) continue;

    const mensagem = preencherTemplate(regra.mensagemTemplate, { produto: linha.product_name });
    await criarOportunidade({ regra, consumerId: linha.consumer_id, descricao: `Comprou ${linha.product_name} ${linha.total}x, sugerir assinatura`, mensagem, produtoId: linha.product_id, score: 58, log });
    criadas += 1;
  }
  return criadas;
}

// 21. Assinatura cancelada — tentar reconquistar (#68)
async function runAssinaturaCancelada(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const diasAposCancelamento = Number(regra.condicoes["diasAposCancelamento"] ?? 7);
  const limite = new Date(Date.now() - diasAposCancelamento * DAY_MS);

  const canceladas = await db.select().from(assinaturasTable)
    .where(and(eq(assinaturasTable.status, "cancelada"), sql`${assinaturasTable.canceladaEm} IS NOT NULL`, lt(assinaturasTable.canceladaEm, limite)));

  let criadas = 0;
  for (const assinatura of canceladas) {
    const mensagem = preencherTemplate(regra.mensagemTemplate, {});
    await criarOportunidade({ regra, consumerId: assinatura.consumerId, descricao: `Cancelou assinatura ha ${diasAposCancelamento}+ dias`, mensagem, produtoId: assinatura.productId, score: 55, log });
    criadas += 1;
  }
  return criadas;
}

// 22. Horario de almoco (#64) — o unico "gatilho externo" que nao
// depende de API externa (geolocalizacao, clima), e so padrao de
// horario. Se o batch nao rodar nesse horario, essa regra nao encontra
// ninguem — precisaria de execucao mais frequente que 1x/dia (ver README).
async function runHorarioAlmoco(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const horaAtual = new Date().getHours();
  const inicio = Number(regra.condicoes["horaInicio"] ?? 12);
  const fim = Number(regra.condicoes["horaFim"] ?? 14);
  if (horaAtual < inicio || horaAtual >= fim) return 0;

  const clientesDelivery = await db.execute(sql`
    SELECT DISTINCT o.consumer_id FROM orders o JOIN order_items oi ON oi.order_id = o.id
    JOIN produtos_catalogo pc ON pc.id = oi.product_id
    JOIN categorias_produto cp ON cp.id = pc.categoria_id
    WHERE o.consumer_id IS NOT NULL AND cp.nome ILIKE '%restaurante%'
    LIMIT 1000
  `);

  let criadas = 0;
  for (const linha of clientesDelivery.rows as unknown as { consumer_id: number }[]) {
    const mensagem = preencherTemplate(regra.mensagemTemplate, {});
    await criarOportunidade({ regra, consumerId: linha.consumer_id, descricao: "Horario de almoco, cliente com historico de delivery", mensagem, score: 62, log });
    criadas += 1;
  }
  return criadas;
}

// 23. Auto-presente (#62) — comprou pra endereco/nome diferente do
// proprio nas ultimas N compras, sugerir "e voce, ja se presenteou?"
async function runAutoPresente(regra: ScoutPraRegra, log: Logger): Promise<number> {
  const diasJanela = Number(regra.condicoes["diasJanela"] ?? 30);
  const limite = new Date(Date.now() - diasJanela * DAY_MS);

  const pedidosRecentes = await db
    .select({ id: ordersTable.id, consumerId: ordersTable.consumerId, deliveryAddress: ordersTable.deliveryAddress })
    .from(ordersTable)
    .where(and(gte(ordersTable.createdAt, limite), sql`${ordersTable.consumerId} IS NOT NULL`));

  let criadas = 0;
  for (const pedido of pedidosRecentes) {
    if (!pedido.consumerId) continue;
    const [consumidor] = await db.select({ name: consumersTable.name }).from(consumersTable).where(eq(consumersTable.id, pedido.consumerId));
    if (!consumidor) continue;
    let endereco: { recipientName?: string };
    try {
      endereco = JSON.parse(pedido.deliveryAddress);
    } catch {
      continue;
    }
    // Heurística simples: nome do destinatário no endereço diferente do
    // nome cadastrado — sinal de que foi presente pra outra pessoa.
    if (!endereco.recipientName || endereco.recipientName.trim().toLowerCase() === consumidor.name.trim().toLowerCase()) continue;

    const mensagem = preencherTemplate(regra.mensagemTemplate, {});
    await criarOportunidade({ regra, consumerId: pedido.consumerId, descricao: "Comprou pra outra pessoa recentemente, sugerir auto-presente", mensagem, score: 45, log });
    criadas += 1;
  }
  return criadas;
}

const RUNNERS: Partial<Record<string, (regra: ScoutPraRegra, log: Logger) => Promise<number>>> = {
  carrinho_abandonado: runCarrinhoAbandonado,
  estoque_baixo: runEstoqueBaixo,
  recompra_programada: runRecompraProgramada,
  reativacao_inativo: runReativacaoInativo,
  milestone_compras: runMilestoneCompras,
  pos_compra_avaliacao: runPosCompraAvaliacao,
  favorito_preco_caiu: runFavoritoPrecoCaiu,
  aniversario: runAniversario,
  pontos_expirando: runPontosExpirando,
  cross_sell: runCrossSell,
  upsell: runUpsell,
  produto_nova_versao: runProdutoNovaVersao,
  sazonalidade_evento: runSazonalidadeEvento,
  nps_baixo: runNpsBaixo,
  navegacao_intensa: runNavegacaoIntensa,
  busca_sem_resultado: runBuscaSemResultado,
  cupom_expirando: runCupomExpirando,
  promocao_relampago: runPromocaoRelampago,
  beneficio_nao_usado: runBeneficioNaoUsado,
  adesao_assinatura: runAssinaturaDisponivel,
  assinatura_cancelada: runAssinaturaCancelada,
  gatilho_externo: runHorarioAlmoco,
  auto_presente: runAutoPresente,
};

export async function runScoutPraTodasRegras(log: Logger): Promise<{ tipo: string; criadas: number }[]> {
  const regras = await db.select().from(scoutPraRegrasTable).where(eq(scoutPraRegrasTable.ativo, true));
  const resultados: { tipo: string; criadas: number }[] = [];

  for (const regra of regras) {
    const runner = RUNNERS[regra.tipo];
    if (!runner) {
      log.info({ tipo: regra.tipo }, "scout-pra: tipo de regra ainda sem mecanismo implementado, pulando");
      continue;
    }
    try {
      const criadas = await runner(regra, log);
      resultados.push({ tipo: regra.tipo, criadas });
    } catch (err) {
      log.error({ err, tipo: regra.tipo }, "scout-pra: falha ao rodar regra");
    }
  }
  return resultados;
}
