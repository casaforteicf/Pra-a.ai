import pg from "pg";

const { Pool } = pg;

// Conexão dedicada ao Supabase compartilhado com o Vendor.ai (catálogo real).
// Usa VENDOR_DATABASE_URL se definida; senão cai pra DATABASE_URL (caso o
// ambiente já aponte tudo pro mesmo banco, conforme a arquitetura decidida:
// "Praça.ai lê direto do catálogo já cadastrado no Vendor.ai, mesmo Supabase").
const connectionString = process.env.VENDOR_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "VENDOR_DATABASE_URL (ou DATABASE_URL) precisa estar configurada para ler o catálogo do Vendor.ai.",
  );
}

export const vendorPool = new Pool({ connectionString });
