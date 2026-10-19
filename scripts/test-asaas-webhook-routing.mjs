import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import * as crypto from "node:crypto";
import vm from "node:vm";

// Executa o módulo real de rotas com dependências isoladas, sem banco ou rede.
// Node 24: node --experimental-vm-modules scripts/test-asaas-webhook-routing.mjs
const source = await readFile(new URL("../artifacts/api-server/src/routes/rounds.ts", import.meta.url), "utf8");
const handlers = [];
let externalCalls = 0;
const forbidden = () => { externalCalls++; throw new Error("Banco/rede não devem ser usados neste teste"); };
const router = new Proxy({}, { get: (_target, method) => (...args) => { if (method === "post" && args[0] === "/webhooks/asaas") handlers.push(args[1]); return router; } });
const stubs = {
  express: { Router: () => router },
  "node:crypto": { randomBytes: crypto.randomBytes, randomUUID: crypto.randomUUID, timingSafeEqual: crypto.timingSafeEqual },
  "@workspace/db": { pool: { query: forbidden, connect: forbidden } },
  "../lib/vendorDb": { vendorPool: { query: forbidden } },
  "../lib/vendorSyncService": { sendChatMessage: forbidden },
  "../lib/asaas": { createOrGetCustomer: forbidden, createCharge: forbidden, getPixQrCode: forbidden, isAsaasConfigured: forbidden },
  "./quotes": { confirmDirectQuotePayment: forbidden },
};
const mod = new vm.SourceTextModule(stripTypeScriptTypes(source, { mode: "transform" }));
await mod.link(async specifier => {
  assert.ok(stubs[specifier], "Dependência não isolada: " + specifier);
  const values = stubs[specifier];
  return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); });
});
await mod.evaluate();
assert.equal(handlers.length, 1);
const handler = handlers[0];
const previous = process.env.ASAAS_WEBHOOK_TOKEN;
const secret = "a".repeat(40);
async function call({ reference, id = "pay_test", token = secret, event = "PAYMENT_CREATED" } = {}) {
  let forwarded = 0, status = 200, body;
  const res = { status(code) { status = code; return this; }, json(value) { body = value; return this; } };
  await handler({ body: { event, payment: { id, externalReference: reference } }, header: () => token }, res, () => { forwarded++; });
  return { forwarded, status, body };
}
try {
  process.env.ASAAS_WEBHOOK_TOKEN = secret;
  for (const reference of ["PRACA-2026-0001", "OTHER:123", undefined, 123]) {
    const result = await call({ reference, token: "" });
    assert.equal(result.forwarded, 1); assert.equal(result.body, undefined);
  }
  for (const reference of ["PRACA_QUOTE_REQUEST:request-1", "PRACA_ROUND_ORDER:order-1"]) {
    assert.equal((await call({ reference, token: "" })).status, 401);
    assert.equal((await call({ reference, token: "é".repeat(40) })).status, 401);
    const accepted = await call({ reference });
    assert.equal(accepted.status, 200); assert.equal(accepted.forwarded, 0);
    assert.equal((await call({ reference, id: "" })).status, 400);
  }
  delete process.env.ASAAS_WEBHOOK_TOKEN;
  assert.equal((await call({ reference: "PRACA-2026-0001" })).forwarded, 1);
  assert.equal((await call({ reference: "PRACA_ROUND_ORDER:order-1" })).status, 401);
  assert.equal(externalCalls, 0);
  console.log("PASS: checkout tradicional encaminhado; cotação/rodada autenticadas; token multibyte rejeitado sem erro; cobrança ausente rejeitada; zero chamadas externas.");
} finally {
  if (previous === undefined) delete process.env.ASAAS_WEBHOOK_TOKEN;
  else process.env.ASAAS_WEBHOOK_TOKEN = previous;
}
