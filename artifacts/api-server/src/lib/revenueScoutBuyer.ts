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
  type ScoutPraRegra,
} from "@workspace/db";
import { vendorPool } from "./vendorDb";
import type { Logger } from "pino";

const DAY_MS = 1000 * 60 * 60 * 24;

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
  }
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

    const valorTotal = itens.reduce((soma, i) => soma + Number(i.productPrice) * i.quantity, 0);
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

const RUNNERS: Partial<Record<string, (regra: ScoutPraRegra, log: Logger) => Promise<number>>> = {
  carrinho_abandonado: runCarrinhoAbandonado,
  estoque_baixo: runEstoqueBaixo,
  recompra_programada: runRecompraProgramada,
  reativacao_inativo: runReativacaoInativo,
  milestone_compras: runMilestoneCompras,
  pos_compra_avaliacao: runPosCompraAvaliacao,
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
