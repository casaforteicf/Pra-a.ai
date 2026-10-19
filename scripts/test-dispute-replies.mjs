import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Exercise the real Express route without external services or customer data.
const require = createRequire(new URL('../artifacts/api-server/package.json', import.meta.url));
const { build } = require('esbuild');
const express = require('express');
const dir = await mkdtemp(join(tmpdir(), 'praca-disputes-'));
let state, snapshot;
const query = async (sql, values = []) => {
  if (sql === 'BEGIN') { snapshot = structuredClone(state); return { rows: [] }; }
  if (sql === 'ROLLBACK') { state = snapshot; return { rows: [] }; }
  if (sql === 'COMMIT') return { rows: [] };
  if (sql.includes('FROM quote_requests q') || sql.includes('FROM buying_round_orders o')) return { rows: values[1] === state.buyer ? [{ id: values[0], status: 'paid' }] : [] };
  if (sql.includes('SELECT id,order_type,order_id')) return { rows: state.exists ? [{ id: 'case-1', status: state.status }] : [] };
  if (sql.includes('actor_type AS "actorType"')) return { rows: state.events };
  if (sql.startsWith('SELECT id,status FROM praca_order_disputes')) return { rows: state.exists ? [{ id: 'case-1', status: state.status }] : [] };
  if (sql.startsWith('INSERT INTO praca_order_dispute_events')) {
    if (state.failInsert) throw new Error('Simulated database failure');
    state.events.push({ buyer: values[1], response: values[2] }); return { rows: [] };
  }
  if (sql.startsWith('UPDATE praca_order_disputes')) { state.status = 'em_analise'; return { rows: [] }; }
  throw new Error('Unexpected SQL in test: ' + sql);
};
globalThis.__disputeTestDb = { pool: { query, connect: async () => ({ query, release() {} }) } };
const outfile = join(dir, 'routes.cjs');
await build({
  entryPoints: [new URL('../artifacts/api-server/src/routes/disputes.ts', import.meta.url).pathname],
  outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
  plugins: [{ name: 'isolated-db', setup(b) {
    b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: 'db', namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const pool=globalThis.__disputeTestDb.pool; export const db={}; export const disputesTable={}; export const ordersTable={};', loader: 'js' }));
  } }],
});
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.session = { consumerId: req.header('x-test-buyer') }; next(); });
app.use(require(outfile).default);
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const id = '11111111-1111-4111-8111-111111111111';
const reset = () => { state = { buyer: 7, status: 'aguardando_comprador', exists: true, events: [], failInsert: false }; };
async function submit({ buyer = '7', response = 'O material entregue está incompleto.', type = 'quote' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (buyer !== null) headers['x-test-buyer'] = buyer;
  return fetch(`${base}/marketplace-orders/${type}/${id}/disputa/resposta`, { method: 'POST', headers, body: JSON.stringify({ response }) });
}
try {
  reset();
  const historyUrl = `${base}/marketplace-orders/quote/${id}/disputa`;
  assert.equal((await fetch(historyUrl)).status, 401);
  assert.equal((await fetch(historyUrl, { headers: { 'x-test-buyer': '8' } })).status, 404);
  state.events.push({ id: 'event-1', actorType: 'admin', note: 'Informe a quantidade faltante.' });
  const history = await fetch(historyUrl, { headers: { 'x-test-buyer': '7' } });
  assert.equal(history.status, 200); assert.equal(history.headers.get('cache-control'), 'no-store');
  assert.equal((await history.json()).events[0].note, 'Informe a quantidade faltante.');
  reset(); assert.equal((await submit({ buyer: null })).status, 401);
  reset(); assert.equal((await submit({ buyer: '8' })).status, 404); assert.equal(state.events.length, 0);
  reset(); assert.equal((await submit({ response: 'curta' })).status, 422);
  reset(); state.exists = false; assert.equal((await submit()).status, 404);
  for (const status of ['aberta', 'em_analise', 'resolvida', 'rejeitada']) {
    reset(); state.status = status; assert.equal((await submit()).status, 409); assert.equal(state.events.length, 0);
  }
  for (const type of ['quote', 'round']) {
    reset(); const response = await submit({ type }); assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'em_analise'); assert.equal(state.status, 'em_analise');
    assert.equal(state.events.length, 1); assert.equal(state.events[0].buyer, 7);
    assert.equal((await submit({ type })).status, 409); assert.equal(state.events.length, 1);
  }
  reset(); state.failInsert = true; assert.equal((await submit()).status, 500);
  assert.equal(state.status, 'aguardando_comprador'); assert.equal(state.events.length, 0);
  console.log('PASS: buyer ownership, authentication, validation, both order types, state transitions, duplicate submission and rollback.');
} finally {
  await new Promise(resolve => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
  delete globalThis.__disputeTestDb;
}
