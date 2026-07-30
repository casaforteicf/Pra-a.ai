import { logger } from "./logger";

/**
 * Cliente Asaas do Praça.ai — cobra o cliente final usando a conta da
 * PLATAFORMA (ASAAS_API_KEY), não a de cada lojista individualmente.
 *
 * Isso torna o checkout real (o cliente recebe um PIX/boleto/cobrança de
 * cartão de verdade pra pagar), mas SEM split automático pros lojistas —
 * repassar o valor de cada venda pro lojista certo ainda depende de cada
 * um ter uma subconta Asaas própria com walletId (fluxo de onboarding com
 * CPF/CNPJ, dados bancários, KYC), que é uma decisão de produto maior e
 * não foi construída aqui. Até isso existir, o repasse é manual/fora do
 * sistema — mas o dinheiro do cliente já é cobrado de verdade, o que
 * resolve o gap mais grave (checkout inteiramente simulado).
 */

const BASE_URL = process.env.ASAAS_SANDBOX === "true"
  ? "https://sandbox.asaas.com/api/v3"
  : "https://www.asaas.com/api/v3";

function getApiKey(): string | null {
  return process.env.ASAAS_API_KEY ?? null;
}

export function isAsaasConfigured(): boolean {
  return !!getApiKey();
}

async function asaasRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = getApiKey();
  if (!key) {
    throw new Error("ASAAS_API_KEY não configurada");
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", access_token: key },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json()) as unknown;

  if (!res.ok) {
    const errMsg = (data as any)?.errors?.[0]?.description ?? `Asaas API error ${res.status}`;
    logger.warn({ status: res.status, path, body: data }, `Asaas error: ${errMsg}`);
    throw new Error(errMsg);
  }

  return data as T;
}

export type AsaasBillingType = "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED";

const PAYMENT_METHOD_TO_BILLING_TYPE: Record<string, AsaasBillingType> = {
  pix: "PIX",
  boleto: "BOLETO",
  credit_card: "CREDIT_CARD",
};

export function paymentMethodToBillingType(paymentMethod: string): AsaasBillingType {
  return PAYMENT_METHOD_TO_BILLING_TYPE[paymentMethod] ?? "UNDEFINED";
}

export interface AsaasCustomerOutput {
  id: string;
  name: string;
  email: string;
}

/**
 * Cria (ou reaproveita, se já existir por e-mail/CPF) o cliente no Asaas.
 * cpfCnpj é opcional aqui porque nem todo checkout do Praça.ai coleta CPF
 * ainda — Asaas aceita cobrança sem CPF pra PIX/cartão, mas exige pra
 * boleto; isso é validado antes de chamar essa função.
 */
export async function createOrGetCustomer(data: {
  name: string;
  email?: string | null;
  cpfCnpj?: string | null;
  phone?: string | null;
}): Promise<AsaasCustomerOutput> {
  if (data.email) {
    const existing = await asaasRequest<{ data: AsaasCustomerOutput[] }>(
      "GET",
      `/customers?email=${encodeURIComponent(data.email)}&limit=1`,
    );
    if (existing.data.length > 0 && existing.data[0]) {
      return existing.data[0];
    }
  }
  return asaasRequest<AsaasCustomerOutput>("POST", "/customers", {
    name: data.name,
    email: data.email ?? undefined,
    cpfCnpj: data.cpfCnpj ?? undefined,
    phone: data.phone ?? undefined,
  });
}

export interface AsaasChargeOutput {
  id: string;
  status: string;
  invoiceUrl: string;
  bankSlipUrl: string | null;
}

export async function createCharge(data: {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
}): Promise<AsaasChargeOutput> {
  return asaasRequest<AsaasChargeOutput>("POST", "/payments", data);
}

export interface AsaasPixQrCode {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

export async function getPixQrCode(chargeId: string): Promise<AsaasPixQrCode> {
  return asaasRequest<AsaasPixQrCode>("GET", `/payments/${chargeId}/pixQrCode`);
}
