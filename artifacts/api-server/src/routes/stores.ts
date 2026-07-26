import { Router, type IRouter } from "express";
import { count, eq, sql } from "drizzle-orm";
import { db, orderItemsTable, ordersTable } from "@workspace/db";
import { vendorPool } from "../lib/vendorDb";

const router: IRouter = Router();

// Piso mínimo de pedidos antes de atribuir qualquer nível — evita nível
// injusto (bom ou ruim demais) pra loja nova sem dado suficiente (auditoria,
// item 8). Abaixo disso, badge neutro "Novo na Praça.ai".
const PISO_MINIMO_PEDIDOS = 10;

function calcularNivel(totalPedidos: number, pctEntregue: number): string {
  if (totalPedidos < PISO_MINIMO_PEDIDOS) return "novo";
  if (pctEntregue >= 95) return "platinum";
  if (pctEntregue >= 90) return "ouro";
  if (pctEntregue >= 80) return "prata";
  return "bronze";
}

router.get("/lojas/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const tenantResult = await vendorPool.query(
      `SELECT id, nome_empresa, cidade, created_at
       FROM tenants WHERE id = $1 AND vende_no_praca_ai = true`,
      [id],
    );

    if (tenantResult.rows.length === 0) {
      res.status(404).json({ error: "Loja não encontrada" });
      return;
    }

    const tenant = tenantResult.rows[0];

    // Estatísticas reais de venda — a partir dos pedidos que já passaram por
    // essa loja no Praça.ai (banco próprio do Praça.ai, não o do Vendor.ai).
    const distinctOrdersForVendor = db
      .selectDistinct({ orderId: orderItemsTable.orderId })
      .from(orderItemsTable)
      .where(eq(orderItemsTable.vendorId, id))
      .as("distinct_orders");

    const [{ total }] = await db
      .select({ total: count() })
      .from(distinctOrdersForVendor);

    const [{ entregues }] = await db
      .select({ entregues: count() })
      .from(distinctOrdersForVendor)
      .innerJoin(ordersTable, eq(ordersTable.id, distinctOrdersForVendor.orderId))
      .where(eq(ordersTable.status, "delivered"));

    const totalPedidos = Number(total ?? 0);
    const totalEntregues = Number(entregues ?? 0);
    // Proxy honesto: % de pedidos que chegaram a "entregue", não
    // necessariamente "dentro do prazo" — não existe timestamp de entrega
    // real pra comparar com a data estimada ainda (gap documentado).
    const pctEntregue = totalPedidos > 0 ? (totalEntregues / totalPedidos) * 100 : 0;

    const nivel = calcularNivel(totalPedidos, pctEntregue);
    const tempoDeCasaDias = Math.floor(
      (Date.now() - new Date(tenant.created_at).getTime()) / 86400000,
    );

    res.json({
      id: tenant.id,
      name: tenant.nome_empresa,
      cidade: tenant.cidade,
      nivelReputacao: nivel,
      totalPedidos,
      totalEntregues,
      pctEntregue: Math.round(pctEntregue * 10) / 10,
      tempoDeCasaDias,
      // Avaliação (nota média) ainda depende da seção 4/9.9 — zerado até existir.
      rating: 0,
      reviewCount: 0,
    });
  } catch (err) {
    console.error("[lojas] erro ao montar página da loja:", err);
    res.status(500).json({ error: "Não foi possível carregar a loja agora." });
  }
});

export default router;
