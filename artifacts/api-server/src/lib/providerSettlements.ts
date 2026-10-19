import { pool } from "@workspace/db";
import { vendorPool } from "./vendorDb";

export const providerSettlementsEnabled = () => process.env.PRACA_PROVIDER_SETTLEMENTS_ENABLED === "true";

export async function marketplaceSplits(orderId: number): Promise<Array<{ walletId: string; fixedValue: number }>> {
  if (!providerSettlementsEnabled()) return [];
  const suborders = await pool.query("SELECT vendor_id,total_cents FROM praca_suborders WHERE order_id=$1 ORDER BY vendor_id", [orderId]);
  const splits: Array<{ walletId: string; fixedValue: number }> = [];
  for (const row of suborders.rows) {
    const profile = await vendorPool.query("SELECT asaas_wallet_id,praca_financial_status,comissao_praca_ai_percentual FROM tenants WHERE id=$1", [row.vendor_id]);
    const vendor = profile.rows[0];
    if (!vendor?.asaas_wallet_id || vendor.praca_financial_status !== "approved") throw new Error(`Cadastro financeiro incompleto para a loja ${row.vendor_id}.`);
    const feeBps = Math.round(Number(vendor.comissao_praca_ai_percentual ?? 8) * 100);
    const netCents = Math.floor(Number(row.total_cents) * (10000 - feeBps) / 10000);
    if (netCents > 0) splits.push({ walletId: String(vendor.asaas_wallet_id), fixedValue: netCents / 100 });
  }
  return splits;
}

export async function bindMarketplaceSplitIds(orderId: number, splits: Array<{ id?: string; walletId?: string }> | undefined): Promise<void> {
  if (!providerSettlementsEnabled() || !splits?.length) return;
  for (const split of splits) {
    if (!split.id || !split.walletId) continue;
    const vendor = await vendorPool.query("SELECT id FROM tenants WHERE asaas_wallet_id=$1 LIMIT 1", [split.walletId]);
    const vendorId = vendor.rows[0]?.id;
    if (!vendorId) continue;
    await pool.query(
      `UPDATE praca_suborders
       SET provider_split_id=$1, settlement_status='escrow_pending', updated_at=now()
       WHERE order_id=$2 AND vendor_id=$3 AND provider_split_id IS NULL`,
      [split.id, orderId, vendorId],
    );
  }
}
export async function singleVendorSplit(vendorId: string, total: number): Promise<Array<{ walletId: string; fixedValue: number }>> {
  if (!providerSettlementsEnabled()) return [];
  const profile = await vendorPool.query("SELECT asaas_wallet_id,praca_financial_status,comissao_praca_ai_percentual FROM tenants WHERE id=$1", [vendorId]);
  const vendor = profile.rows[0];
  if (!vendor?.asaas_wallet_id || vendor.praca_financial_status !== "approved") throw new Error("Cadastro financeiro da loja ainda não foi aprovado.");
  const feeBps = Math.round(Number(vendor.comissao_praca_ai_percentual ?? 8) * 100);
  const fixedValue = Math.floor(Math.round(total * 100) * (10000 - feeBps) / 10000) / 100;
  return fixedValue > 0 ? [{ walletId: String(vendor.asaas_wallet_id), fixedValue }] : [];
}
