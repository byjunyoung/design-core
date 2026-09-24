import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/serve.js';
import { propose } from '../src/proposals.js';

const examples = fileURLToPath(new URL('../examples/store-ops', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'dc-srv-'));
cpSync(examples, dir, { recursive: true });
const server = await startServer(dir, { port: 0, branch: 'feature/x', today: '2026-09-24' });
const base = `http://127.0.0.1:${server.port}`;
after(() => server.close());

test('the server renders the index and a screen page on request, with the comment box wired in', async () => {
  const index = await (await fetch(`${base}/`)).text();
  assert.match(index, /inventory-list\.html/);
  const page = await (await fetch(`${base}/inventory-list.html`)).text();
  assert.match(page, /data-path="elements\.1\.children\.1"/);
  assert.match(page, /DOAN_API/);
});

test('comments can be posted from the page and read back per screen', async () => {
  const res = await fetch(`${base}/api/comments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ screen: 'inventory-list', path: 'elements.1.children.1', text: 'drop the line column', author: 'junyoung' }) });
  assert.equal(res.status, 201);
  const list = await (await fetch(`${base}/api/comments?screen=inventory-list`)).json();
  assert.equal(list.comments.length, 1);
  assert.equal(list.comments[0].text, 'drop the line column');
  const page = await (await fetch(`${base}/inventory-list.html`)).text();
  assert.match(page, /drop the line column/, 'the rendered page shows open comments');
});

test('a pending proposal can be applied from its page with a name, and refused without one', async () => {
  const before = readFileSync(join(dir, 'screens', 'payment-list.yaml'), 'utf8');
  const p = await propose(dir, { screen: 'payment-list', after: before.replace('columns: [nickname, order_no, store, method, amount, status, paid_at]', 'columns: [nickname, amount]') }, { branch: 'feature/x', today: '2026-09-24' });
  const page = await (await fetch(`${base}/proposal-${p.id}.html`)).text();
  assert.match(page, /id="approve"/);
  const denied = await fetch(`${base}/api/proposals/${p.id}/apply`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(denied.status, 400);
  const ok = await fetch(`${base}/api/proposals/${p.id}/apply`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ by: 'junyoung' }) });
  assert.equal(ok.status, 200);
  assert.match(readFileSync(join(dir, 'screens', 'payment-list.yaml'), 'utf8'), /\[nickname, amount\]/);
});

test('lint is served as JSON for a bot to read', async () => {
  const lint = await (await fetch(`${base}/api/lint`)).json();
  assert.equal(typeof lint.summary.blocking, 'number');
});
