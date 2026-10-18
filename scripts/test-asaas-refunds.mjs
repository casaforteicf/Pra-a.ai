import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(new URL("../artifacts/api-server/package.json", import.meta.url));
const { build } = require("esbuild");
const dir = await mkdtemp(join(tmpdir(), "praca-asaas-refund-"));
try {
  const outfile = join(dir, "asaas.cjs");
  await build({
    entryPoints: [new URL("../artifacts/api-server/src/lib/asaas.ts", import.meta.url).pathname],
    outfile, bundle: true, platform: "node", format: "cjs", logLevel: "silent",
    plugins: [{ name: "stub-logger", setup(plugin) {
      plugin.onResolve({ filter: /\/logger$/ }, () => ({ path: "logger", namespace: "test" }));
      plugin.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: "export const logger={warn(){}};", loader: "js" }));
    } }],
  });
  process.env.ASAAS_SANDBOX = "true";
  process.env.ASAAS_API_KEY = "test-key";
  const { refundCharge, AsaasApiError } = require(outfile);
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ id: "pay_test", status: "PENDING" }) };
  };
  const result = await refundCharge("pay_test-123", "Cancelamento Praça.ai");
  assert.equal(result.status, "PENDING");
  assert.equal(request.url, "https://sandbox.asaas.com/api/v3/payments/pay_test-123/refund");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.access_token, "test-key");
  assert.deepEqual(JSON.parse(request.options.body), { description: "Cancelamento Praça.ai" });

  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 422, json: async () => ({ errors: [{ description: "rejected" }] }) }; };
  await assert.rejects(refundCharge("pay_test", "reason"), (error) => error instanceof AsaasApiError && error.status === 422);
  await assert.rejects(refundCharge("bad/id", "reason"), /Identificador de cobrança inválido/);
  assert.equal(calls, 1, "IDs inválidos não devem fazer chamadas à Asaas");
  console.log("Asaas refund client tests passed.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
