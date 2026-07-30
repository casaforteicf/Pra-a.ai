import { pool } from "@workspace/db";
import { logger } from "./lib/logger";

// Cria as tabelas próprias do Praça.ai caso ainda não existam. Idempotente
// (CREATE TABLE IF NOT EXISTS em tudo) e seguro num banco compartilhado com
// o Vendor.ai — nunca altera ou remove nada que já exista.
const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS consumers (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  password_hash text NOT NULL,
  saldo_moedas integer NOT NULL DEFAULT 0,
  ultimo_checkin_em text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carts (
  id serial PRIMARY KEY,
  consumer_id integer REFERENCES consumers(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id serial PRIMARY KEY,
  cart_id integer NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  product_name text NOT NULL,
  product_image_url text NOT NULL,
  product_price numeric(10,2) NOT NULL,
  vendor_id text,
  quantity integer NOT NULL DEFAULT 1,
  selected_size text
);

CREATE TABLE IF NOT EXISTS orders (
  id serial PRIMARY KEY,
  order_number text NOT NULL UNIQUE,
  consumer_id integer REFERENCES consumers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'confirmed',
  subtotal numeric(10,2) NOT NULL,
  shipping numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL,
  payment_method text NOT NULL,
  delivery_address text NOT NULL,
  delivery_option text NOT NULL,
  coupon_code text,
  estimated_delivery text,
  tracking_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  product_name text NOT NULL,
  product_image_url text NOT NULL,
  quantity integer NOT NULL,
  price_at_purchase numeric(10,2) NOT NULL,
  vendor_id text,
  selected_size text
);

CREATE TABLE IF NOT EXISTS order_deal_links (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id text NOT NULL,
  deal_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favorites (
  id serial PRIMARY KEY,
  consumer_id integer NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT favorites_consumer_product UNIQUE (consumer_id, product_id)
);

CREATE TABLE IF NOT EXISTS disputes (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  consumer_id integer REFERENCES consumers(id) ON DELETE SET NULL,
  motivo text NOT NULL,
  descricao text NOT NULL,
  evidencia_url text,
  status text NOT NULL DEFAULT 'aberta',
  frete_devolucao_responsavel text,
  frete_devolucao_valor_vendedor numeric(10,2),
  frete_devolucao_valor_entregador numeric(10,2),
  resolucao_texto text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz
);

CREATE TABLE IF NOT EXISTS product_questions (
  id serial PRIMARY KEY,
  product_id text NOT NULL,
  vendor_id text NOT NULL,
  consumer_id integer REFERENCES consumers(id) ON DELETE SET NULL,
  pergunta text NOT NULL,
  resposta text,
  respondido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coin_transactions (
  id serial PRIMARY KEY,
  consumer_id integer NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  quantidade integer NOT NULL,
  motivo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_reviews (
  id serial PRIMARY KEY,
  product_id text NOT NULL,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  consumer_id integer NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  nota integer NOT NULL,
  comentario text,
  midia_urls jsonb,
  moedas_ganhas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ambassadors (
  id serial PRIMARY KEY,
  consumer_id integer NOT NULL UNIQUE REFERENCES consumers(id) ON DELETE CASCADE,
  codigo text NOT NULL UNIQUE,
  saldo_comissao numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referrals (
  id serial PRIMARY KEY,
  ambassador_id integer NOT NULL REFERENCES ambassadors(id) ON DELETE CASCADE,
  indicado_tipo text NOT NULL,
  indicado_consumer_id integer REFERENCES consumers(id) ON DELETE SET NULL,
  indicado_tenant_id text,
  status text NOT NULL DEFAULT 'pendente',
  valor_comissao numeric(10,2),
  convertido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_partners (
  id serial PRIMARY KEY,
  praca text NOT NULL DEFAULT 'Chapecó',
  nome text NOT NULL,
  telefone text NOT NULL,
  veiculo_tipo text NOT NULL,
  status text NOT NULL DEFAULT 'offline',
  avaliacao_media numeric(3,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_points (
  id serial PRIMARY KEY,
  praca text NOT NULL DEFAULT 'Chapecó',
  nome text NOT NULL,
  endereco text NOT NULL,
  tipo text NOT NULL DEFAULT 'loja_parceira',
  ativo text NOT NULL DEFAULT 'true',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deliveries (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id text NOT NULL,
  partner_id integer REFERENCES delivery_partners(id) ON DELETE SET NULL,
  support_point_id integer,
  status text NOT NULL DEFAULT 'aguardando',
  valor_pago_parceiro numeric(10,2),
  aceita_em timestamptz,
  coletada_em timestamptz,
  entregue_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session (
  sid varchar PRIMARY KEY NOT NULL,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON session (expire);

-- Captura de nome/telefone pra pedidos feitos sem login (checkout anônimo)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_phone text;

-- Estoque real de produto (tabela produtos_catalogo é do Vendor.ai, mas
-- vive no mesmo banco físico — o Praça.ai lê/escreve direto nela via
-- vendorPool). controla_estoque é opt-in por produto: quando false,
-- comportamento antigo (sem checagem) é mantido; quando true, estoque_
-- quantidade passa a valer e bloqueia venda além do disponível.
ALTER TABLE produtos_catalogo ADD COLUMN IF NOT EXISTS estoque_quantidade integer;
ALTER TABLE produtos_catalogo ADD COLUMN IF NOT EXISTS controla_estoque boolean NOT NULL DEFAULT false;

-- Cobrança real via Asaas (só PIX por enquanto — ver comentário em
-- lib/asaas.ts sobre o escopo). Guarda o id da cobrança e o QR code
-- pra exibir na tela de sucesso/pedido.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS asaas_charge_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS asaas_pix_payload text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS asaas_pix_qrcode_image text;
`;

export async function ensurePracaAiTablesExist(): Promise<void> {
  try {
    await pool.query(MIGRATION_SQL);
    logger.info("Migração de tabelas do Praça.ai verificada/aplicada");
  } catch (err) {
    logger.error({ err }, "Falha ao aplicar migração de tabelas do Praça.ai");
    throw err;
  }
}
