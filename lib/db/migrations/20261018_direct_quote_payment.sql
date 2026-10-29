-- Direct quote checkout through the Praça.ai platform account.
-- Additive and safe to run more than once. Funds remain unreleased until delivery settlement is implemented.
ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS asaas_charge_id text,
  ADD COLUMN IF NOT EXISTS asaas_pix_payload text,
  ADD COLUMN IF NOT EXISTS asaas_pix_qrcode_image text,
  ADD COLUMN IF NOT EXISTS asaas_invoice_url text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_requests_asaas_charge
  ON quote_requests (asaas_charge_id)
  WHERE asaas_charge_id IS NOT NULL;
