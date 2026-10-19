import { logger } from "./logger";

/** Cliente Asaas da plataforma: cobrança, split, subcontas, escrow e estornos. O fluxo financeiro novo permanece protegido por flags e exige reconciliação por webhook. */

const BASE_URL = process.env.ASAAS_SANDBOX === "true"
  ? "https://sandbox.asaas.com/api/v3"
  : "https://www.asaas.com/api/v3";

export class AsaasApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "AsaasApiError";
  }
}

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
    throw new AsaasApiError(errMsg, res.status);
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
  split?: Array<{ id?: string; walletId?: string; status?: string }>;
}

export interface AsaasCreditCard {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface AsaasCreditCardHolderInfo {
  name: string;
  email?: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone?: string;
}

export async function createCharge(data: {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
  creditCard?: AsaasCreditCard;
  creditCardHolderInfo?: AsaasCreditCardHolderInfo;
  split?: Array<{ walletId: string; fixedValue: number }>;
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

export interface AsaasPaymentStatusOutput {
  id: string;
  status: string;
  externalReference: string | null;
  value: number;
  netValue?: number;
  refunds?: Array<{ id?: string; status?: string; value?: number; refundedSplits?: Array<{ id?: string; value?: number; done?: boolean }> }>;
}

/** Consulta o estado canônico na API antes de aceitar um webhook como pagamento confirmado. */
export async function getPayment(paymentId: string): Promise<AsaasPaymentStatusOutput> {
  return asaasRequest<AsaasPaymentStatusOutput>("GET", `/payments/${encodeURIComponent(paymentId)}`);
}

export interface AsaasRefundOutput {
  id?: string;
  status?: string;
  [key: string]: unknown;
}

/**
 * Solicita o estorno integral de uma cobrança recebida/confirmada.
 * A conclusão financeira é assíncrona: o estado definitivo deve vir do
 * webhook PAYMENT_REFUNDED/PAYMENT_REFUND_IN_PROGRESS/PAYMENT_REFUND_DENIED.
 */
export async function refundCharge(chargeId: string, description: string, value?: number, splitRefunds?: Array<{ walletId: string; value: number }>): Promise<AsaasRefundOutput> {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(chargeId)) throw new Error("Identificador de cobrança inválido.");
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) throw new Error("Valor de estorno inválido.");
  return asaasRequest<AsaasRefundOutput>("POST", `/payments/${encodeURIComponent(chargeId)}/refund`, {
    description: description.slice(0, 255),
    ...(value === undefined ? {} : { value }),
    ...(splitRefunds?.length ? { splitRefunds } : {}),
  });
}

export interface AsaasSubaccountOutput { id: string; walletId: string; apiKey?: string; }
export async function createSubaccount(data: Record<string, unknown>): Promise<AsaasSubaccountOutput> {
  return asaasRequest<AsaasSubaccountOutput>("POST", "/accounts", data);
}

export async function configureEscrow(accountId: string, daysToExpire: number): Promise<Record<string, unknown>> {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(accountId)) throw new Error("Identificador de subconta inválido.");
  if (!Number.isSafeInteger(daysToExpire) || daysToExpire < 1 || daysToExpire > 180) throw new Error("Prazo de garantia inválido.");
  return asaasRequest("POST", `/accounts/${encodeURIComponent(accountId)}/escrow`, { enabled: true, daysToExpire, isFeePayer: true });
}
