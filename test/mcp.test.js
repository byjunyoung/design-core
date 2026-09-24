import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const examples = fileURLToPath(new URL('../examples/store-ops', import.meta.url));
const server = fileURLToPath(new URL('../src/mcp.js', import.meta.url));

const dir = mkdtempSync(join(tmpdir(), 'dc-mcp-'));
cpSync(examples, dir, { recursive: true });

const client = new Client({ name: 'test', version: '0' });
await client.connect(new StdioClientTransport({ command: 'node', args: [server, dir, '--branch', 'feature/x', '--today', '2026-09-23'] }));
after(() => client.close());

const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content[0].text;
  return { text, json: res.isError ? null : (res.structuredContent ?? JSON.parse(text)), isError: res.isError };
};

test('the server exposes the verbs and the two agent reads', async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ['diff', 'get_screen', 'lint', 'list_missing', 'list_screens', 'prep', 'render', 'propose', 'list_proposals', 'apply', 'reject', 'undo', 'import_figma', 'map_figma', 'list_comments', 'resolve_comment', 'add_comment'].sort());
});

test('lint returns the same JSON the CLI does', async () => {
  const { json } = await call('lint');
  assert.equal(json.summary.blocking, 0);
  assert.ok(json.findings.every((f) => f.file && f.path && f.id));
});

test('get_screen returns the merged view for a state and a variant, and names missing targets', async () => {
  const { json } = await call('get_screen', { screen: 'inventory-edit', state: 'Validation', variants: { item_type: 'CupLid' } });
  assert.equal(json.state, 'Validation');
  assert.deepEqual(json.variants, { item_type: 'CupLid' });
  assert.deepEqual(json.missingTargets, []);
  const flat = JSON.stringify(json.elements);
  assert.doesNotMatch(flat, /"id":"refill"/);
});

test('get_screen on an unknown screen is an error the agent can read', async () => {
  const { isError, text } = await call('get_screen', { screen: 'ghost' });
  assert.equal(isError, true);
  assert.match(text, /ghost/);
});

test('list_missing returns only the required-state and $tbd findings', async () => {
  const { json } = await call('list_missing');
  assert.ok(json.findings.every((f) => f.id === 'L03' || f.id === 'L08'));
  assert.ok(json.findings.length >= 2);
});

test('prep edits the file and reports what it added', async () => {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(dir, 'screens', 'bare.yaml'), 'schema: doan/0.2\nid: scr_MCP1\nscreen: bare\nsection: "02. Inventory"\ntype: list\nelements:\n  - id: table\n    kind: table\n');
  const { json } = await call('prep', { screen: 'bare', owner: 'design' });
  assert.deepEqual(json.added, ['Empty', 'Loading', 'Error']);
  assert.match(readFileSync(join(dir, 'screens', 'bare.yaml'), 'utf8'), /placeholder/);
});

test('diff compares a screen against a git ref or two texts', async () => {
  const a = readFileSync(join(dir, 'screens', 'payment-list.yaml'), 'utf8');
  const b = a.replace('columns: [nickname, order_no, store, method, amount, status, paid_at]', 'columns: [nickname, order_no, amount, status, paid_at]');
  const { json } = await call('diff', { before: a, after: b });
  assert.equal(json.changed.length, 1);
  assert.deepEqual(json.changed[0].path, ['elements', 'table', 'columns']);
  assert.match(json.markdown, /\| elements\.table\.columns \|/);
});

test('render writes the pages and returns their paths', async () => {
  const { json } = await call('render', { out: join(dir, 'out') });
  assert.ok(json.pages.some((p) => p.endsWith('index.html')));
  assert.ok(json.pages.some((p) => p.endsWith('inventory-list.html')));
});

test('propose → pending → apply with approved_by runs over MCP, and list_proposals sees the queue', async () => {
  const before = readFileSync(join(dir, 'screens', 'payment-list.yaml'), 'utf8');
  const after = before.replace('columns: [nickname, order_no, store, method, amount, status, paid_at]', 'columns: [nickname, order_no, amount, status, paid_at]');
  const p = await call('propose', { screen: 'payment-list', after, summary: 'drop store and method columns' });
  assert.equal(p.json.status, 'pending');
  assert.equal(p.json.tier, 'structure');
  const q = await call('list_proposals');
  assert.ok(q.json.proposals.some((x) => x.id === p.json.id));
  const denied = await call('apply', { id: p.json.id });
  assert.equal(denied.isError, true);
  const a = await call('apply', { id: p.json.id, approved_by: 'reviewer' });
  assert.equal(a.json.status, 'applied');
  assert.match(readFileSync(join(dir, 'screens', 'payment-list.yaml'), 'utf8'), /\[nickname, order_no, amount, status, paid_at\]/);
});

test('the server offers a "draw" prompt that walks the agent through decisions before propose', async () => {
  const { prompts } = await client.listPrompts();
  assert.ok(prompts.some((p) => p.name === 'draw'));
  const got = await client.getPrompt({ name: 'draw', arguments: { screen: 'order-list' } });
  const text = got.messages.map((m) => m.content.text).join('\n');
  assert.match(text, /order-list/);
  assert.match(text, /one at a time/i);
  assert.match(text, /propose/);
});

test('render can draw a pending proposal and returns its page', async () => {
  const before = readFileSync(join(dir, 'screens', 'inventory-list.yaml'), 'utf8');
  const p = await call('propose', { screen: 'inventory-list', after: before.replace('page_size: 10', 'page_size: 20'), summary: 'twenty per page' });
  const r = await call('render', { out: join(dir, 'out2'), proposal: p.json.id });
  assert.ok(r.json.pages.some((x) => x.endsWith(`proposal-${p.json.id}.html`)));
});
