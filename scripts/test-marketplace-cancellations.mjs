import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(new URL('../artifacts/api-server/package.json', import.meta.url));
const { build } = require('esbuild');
const express = require('express');
const dir = await mkdtemp(join(tmpdir(), 'praca-cancellations-'));
let state, snapshot;
const query = async (sql, values = []) => {
  if (sql === 'BEGIN') { snapshot = structuredClone(state); return { rows: [] }; }
  if (sql === 'ROLLBACK') { state = snapshot; return { rows: [] }; }
  if (sql === 'COMMIT') return { rows: [] };
  if (sql.includes('FROM quote_requests q JOIN quote_offers') || sql.includes('FROM buying_round_orders o JOIN buying_round_participants')) {
    return { rows: values[1] === state.buyer ? [{ id: values[0], status: state.orderStatus, vendor_id: 'vendor-1', fulfillment_status: state.fulfillment }] : [] };
  }
  if (sql.includes('FROM praca_order_disputes')) return { rows: state.activeDispute ? [{ '?column?': 1 }] : [] };
  if (sql.startsWith('INSERT INTO praca_order_cancellations')) {
    if (state.exists) { const error = new Error('duplicate'); error.code = '23505'; throw error; }
    state.exists = true;
    state.request = { id: 'cancel-1', order_type: values[0], order_id: values[1], reason: values[4], description: values[5], status: 'solicitada' };
    return { rows: [state.request] };
  }
  if (sql.startsWith('INSERT INTO praca_order_cancellation_events')) {
    state.events.push({ actorType: values[2] ?? 'buyer', note: values[4] ?? 'Solicitação enviada pelo comprador' }); return { rows: [] };
  }
  if (sql.includes('FROM praca_order_cancellations WHERE order_type=$1')) return { rows: state.exists ? [state.request] : [] };
  if (sql.includes('FROM praca_order_cancellation_events')) return { rows: state.events };
  throw new Error('Unexpected SQL in test: ' + sql);
};
globalThis.__cancellationTestDb = { pool: { query, connect: async () => ({ query, release() {} }) } };
const outfile = join(dir, 'routes.cjs');
await build({
  entryPoints: [new URL('../artifacts/api-server/src/routes/cancellations.ts', import.meta.url).pathname],
  outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
  plugins: [{ name: 'isolated-db', setup(b) {
    b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: 'db', namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const pool=globalThis.__cancellationTestDb.pool;', loader: 'js' }));
  } }],
});
const app = express(); app.use(express.json());
app.use((req, _res, next) => { req.session = { consumerId: req.header('x-test-buyer') }; next(); });
app.use(require(outfile).default);
const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const id = '11111111-1111-4111-8111-111111111111';
const reset = () => { state = { buyer: 7, orderStatus: 'paid', fulfillment: 'ready', activeDispute: false, exists: false, request: null, events: [] }; };
async function submit({ buyer = '7', type = 'quote', description = 'Não consigo receber no prazo combinado.' } = {}) {
  const headers = { 'Content-Type': 'application/json' }; if (buyer !== null) headers['x-test-buyer'] = buyer;
  return fetch(`${base}/marketplace-orders/${type}/${id}/cancelamento`, { method: 'POST', headers, body: JSON.stringify({ reason: 'prazo', description }) });
}
try {
  reset(); assert.equal((await submit({ buyer: null })).status, 401);
  reset(); assert.equal((await submit({ buyer: '8' })).status, 404); assert.equal(state.exists, false);
  reset(); assert.equal((await submit({ description: 'curta' })).status, 422);
  for (const [orderStatus, fulfillment] of [['awaiting_payment', null], ['delivered', 'shipped'], ['paid', 'shipped']]) {
    reset(); state.orderStatus = orderStatus; state.fulfillment = fulfillment;
    assert.equal((await submit()).status, 409);
  }
  reset(); state.activeDispute = true; assert.equal((await submit()).status, 409);
  for (const type of ['quote', 'round']) {
    reset(); const response = await submit({ type }); assert.equal(response.status, 201);
    const body = await response.json(); assert.equal(body.status, 'solicitada'); assert.equal(state.request.order_type, type);
    assert.equal(state.events.length, 1);
    assert.equal((await submit({ type })).status, 409);
  }
  reset(); state.exists = true; state.request = { id: 'cancel-1', status: 'solicitada' };
  assert.equal((await fetch(`${base}/marketplace-orders/quote/${id}/cancelamento`)).status, 401);
  const history = await fetch(`${base}/marketplace-orders/quote/${id}/cancelamento`, { headers: { 'x-test-buyer': '7' } });
  assert.equal(history.status, 200); assert.equal(history.headers.get('cache-control'), 'no-store');
  console.log('PASS: authentication, order ownership, paid/unshipped rule, active dispute exclusion, quote and round request creation, duplicate prevention and private status endpoint.');
} finally {
  await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); delete globalThis.__cancellationTestDb;
}
