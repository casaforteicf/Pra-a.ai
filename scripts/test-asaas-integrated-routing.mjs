import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import * as crypto from "node:crypto";
import vm from "node:vm";

// Node 24: node --experimental-vm-modules scripts/test-asaas-integrated-routing.mjs
let payment, order, duplicate = false, updates = 0;
const query = async sql => {
  if (sql.includes("SELECT id, order_number")) return { rows: order ? [order] : [] };
  if (sql.includes("INSERT INTO asaas_payment_events")) return { rows: duplicate ? [] : [{ id: 1 }] };
  if (sql.includes("UPDATE orders")) updates++;
  return { rows: [] };
};
const db = { query, connect: async () => ({ query, release() {} }) };
const forbidden = () => { throw new Error("Chamada inesperada fora do checkout"); };
async function loadRoute(path, extra = {}) {
  const handlers = [];
  const router = new Proxy({}, { get: (_t, method) => (...args) => { if (method === "post" && args[0] === "/webhooks/asaas") handlers.push(args[1]); return router; } });
  const stubs = {
    express: { Router: () => router },
    "node:crypto": { randomBytes: crypto.randomBytes, randomUUID: crypto.randomUUID, timingSafeEqual: crypto.timingSafeEqual },
    "@workspace/db": { pool: db },
    "../lib/vendorDb": { vendorPool: { query: forbidden } },
    "../lib/vendorSyncService": { sendChatMessage: forbidden },
    "../lib/asaas": { createOrGetCustomer: forbidden, createCharge: forbidden, getPixQrCode: forbidden, isAsaasConfigured: forbidden, getPayment: async () => payment },
    "./quotes": { confirmDirectQuotePayment: forbidden },
    ...extra,
  };
  const source = await readFile(new URL("../artifacts/api-server/src/routes/" + path, import.meta.url), "utf8");
  const mod = new vm.SourceTextModule(stripTypeScriptTypes(source, { mode: "transform" }));
  await mod.link(async name => {
    assert.ok(stubs[name], "Dependência não isolada: " + name);
    const values = stubs[name];
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [k,v] of Object.entries(values)) this.setExport(k,v); });
  });
  await mod.evaluate(); assert.equal(handlers.length, 1); return handlers[0];
}
const rounds = await loadRoute("rounds.ts"), checkout = await loadRoute("asaasWebhooks.ts");
const token = "a".repeat(40);
const oldToken = process.env.ASAAS_WEBHOOK_TOKEN, oldEnabled = process.env.ASAAS_PAYMENT_WEBHOOK_ENABLED;
async function dispatch(reference = "PRACA-TEST", supplied = token, event = "PAYMENT_RECEIVED") {
  let status = 200, body, forwarded = false;
  const req = { header: () => supplied, body: { id: "evt_test", event, payment: { id: "pay_test", externalReference: reference } } };
  const res = { status(value) { status = value; return this; }, json(value) { body = value; return this; } };
  await rounds(req, res, () => { forwarded = true; });
  if (forwarded) await checkout(req, res);
  return { status, body, forwarded };
}
try {
  const index = await readFile(new URL("../artifacts/api-server/src/routes/index.ts", import.meta.url), "utf8");
  assert.ok(index.indexOf("router.use(roundsRouter);") < index.indexOf("router.use(asaasWebhooksRouter);"));
  process.env.ASAAS_WEBHOOK_TOKEN = token;
  process.env.ASAAS_PAYMENT_WEBHOOK_ENABLED = "true";
  payment = { id: "pay_test", status: "RECEIVED", externalReference: "PRACA-TEST", value: 100 };
  order = { id: 1, order_number: "PRACA-TEST", total: "100.00", asaas_charge_id: "pay_test" };
  let result = await dispatch();
  assert.equal(result.forwarded, true); assert.equal(result.status, 200); assert.equal(updates, 1);
  duplicate = true; result = await dispatch(); assert.equal(result.body.duplicate, true); assert.equal(updates, 1); duplicate = false;
  assert.equal((await dispatch("PRACA-TEST", "")).status, 401);
  payment.value = 99; assert.equal((await dispatch()).status, 422); assert.equal(updates, 1); payment.value = 100;
  payment.status = "PENDING"; assert.equal((await dispatch()).status, 503); payment.status = "RECEIVED";
  order.asaas_charge_id = "pay_other"; assert.equal((await dispatch()).status, 409); order.asaas_charge_id = "pay_test";
  process.env.ASAAS_PAYMENT_WEBHOOK_ENABLED = "false"; assert.equal((await dispatch()).status, 404);
  for (const reference of ["PRACA_QUOTE_REQUEST:q1", "PRACA_ROUND_ORDER:r1"]) {
    result = await dispatch(reference, token, "PAYMENT_CREATED"); assert.equal(result.forwarded, false); assert.equal(result.status, 200);
    assert.equal((await dispatch(reference, "")).status, 401);
  }
  assert.equal(updates, 1);
  console.log("PASS: handlers integrados; checkout confirmado uma vez; duplicata, autenticação, valor, estado e cobrança divergentes; feature flag; cotação/rodada preservadas. Banco e Asaas simulados.");
} finally {
  for (const [key,value] of [["ASAAS_WEBHOOK_TOKEN",oldToken],["ASAAS_PAYMENT_WEBHOOK_ENABLED",oldEnabled]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
