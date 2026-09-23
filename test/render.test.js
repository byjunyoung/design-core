import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadProject } from '../src/index.js';
import { renderScreen, renderIndex } from '../src/render/index.js';

const orders = fileURLToPath(new URL('../examples/orders', import.meta.url));
const ops = fileURLToPath(new URL('../examples/store-ops', import.meta.url));

async function page(dir, name) {
  const project = await loadProject(dir);
  const screen = project.screens.find((s) => s.doc.screen === name);
  return { project, screen, html: renderScreen(project, screen) };
}

test('a screen page shows Default and every state side by side, in states.known order', async () => {
  const { html } = await page(orders, 'order-list');
  const order = ['state-Default', 'state-Empty', 'state-Loading', 'state-Error'].map((id) => html.indexOf(`id="${id}"`));
  assert.ok(order.every((i) => i >= 0), 'every state has a section');
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test('every element carries its YAML path and line, and unknown kinds still render', async () => {
  const { html } = await page(orders, 'order-list');
  assert.match(html, /data-path="elements\.2"[^>]*data-line="\d+"/);
  assert.match(html, /data-kind="pagination"/);
  const project = await loadProject(orders);
  const weird = { ...project.screens[0], doc: { ...project.screens[0].doc, elements: [{ id: 'x', kind: 'hologram', beam: 'wide' }] } };
  const out = renderScreen(project, weird);
  assert.match(out, /data-kind="hologram"/);
  assert.match(out, /beam/);
});

test('a state renders the merged view: Empty shows the empty notice and no pagination', async () => {
  const { html } = await page(orders, 'order-list');
  const empty = html.slice(html.indexOf('id="state-Empty"'), html.indexOf('id="state-Loading"'));
  assert.match(empty, /No orders match\./);
  assert.doesNotMatch(empty, /data-kind="pagination"/);
});

test('a $tbd in a prop renders as a chip with its owner, and a placeholder as an undesigned box', async () => {
  const { html } = await page(orders, 'order-list');
  assert.match(html, /class="tbd"[^>]*>[^<]*pm/);
  const project = await loadProject(orders);
  const s = project.screens.find((x) => x.doc.screen === 'order-list');
  const stub = { ...s, doc: { ...s.doc, states: { Empty: [{ target: 'table', replace: { kind: 'placeholder', text: { $tbd: { owner: 'design', note: 'Empty state not designed yet' } } } }] } } };
  const out = renderScreen(project, stub);
  assert.match(out, /class="el el-placeholder/);
  assert.match(out, /Empty state not designed yet/);
});

test('flows become links to the target page and state anchor', async () => {
  const { html } = await page(orders, 'order-list');
  assert.match(html, /href="order-detail\.html"/);
  assert.match(html, /href="#state-Empty"/);
});

test('layout becomes CSS from tokens, never a number with a unit', async () => {
  const { html } = await page(orders, 'order-list');
  assert.match(html, /--space-lg/);
  assert.match(html, /gap:\s*var\(--space-lg\)/);
  assert.doesNotMatch(html, /gap:\s*\d+px/);
});

test('variants render one row per axis, each option in Default; a modal sits on a backdrop; conditions show as badges', async () => {
  const { html } = await page(ops, 'inventory-edit');
  assert.match(html, /id="variant-item_type-CupLid"/);
  assert.match(html, /class="backdrop"/);
  const { html: list } = await page(ops, 'payment-list');
  assert.match(list, /shown when: a row is selected/);
});

test('the index lists every screen with its blocking and $tbd counts', async () => {
  const project = await loadProject(ops);
  const html = renderIndex(project, { branch: 'feature/x', today: '2026-09-23' });
  for (const s of project.screens) assert.match(html, new RegExp(`href="${s.doc.screen}\\.html"`));
  assert.match(html, /\$tbd/);
});

test('a pending proposal renders AS-IS and TO-BE per state, with its decisions and diff on top', async () => {
  const { mkdtempSync, cpSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { propose } = await import('../src/proposals.js');
  const { renderProposal } = await import('../src/render/index.js');
  const dir = mkdtempSync(join(tmpdir(), 'dc-rp-'));
  cpSync(orders, dir, { recursive: true });
  const before = readFileSync(join(dir, 'screens', 'order-list.yaml'), 'utf8');
  const after = before.replace('columns: [order_no, branch, amount, status, ordered_at]', 'columns: [order_no, amount, status, ordered_at]');
  const p = await propose(dir, { screen: 'order-list', after, summary: 'drop the branch column', decisions: [{ item: 'branch column', decision: 'drop it', why: 'never shown to single-store accounts' }] }, { branch: 'x', today: '2026-09-23' });
  const project = await loadProject(dir);
  const html = renderProposal(project, p);
  assert.match(html, /drop the branch column/);
  assert.match(html, /never shown to single-store accounts/);
  assert.match(html, /elements\.table\.columns/);
  for (const state of ['Default', 'Empty', 'Loading', 'Error']) {
    assert.match(html, new RegExp(`id="asis-${state}"`));
    assert.match(html, new RegExp(`id="tobe-${state}"`));
  }
  const tobe = html.slice(html.indexOf('id="tobe-Default"'), html.indexOf('id="asis-Empty"'));
  assert.doesNotMatch(tobe, /<th>branch</);
  const asis = html.slice(html.indexOf('id="asis-Default"'), html.indexOf('id="tobe-Default"'));
  assert.match(asis, /<th>branch</);
});

test('the index lists pending proposals with a link to their page', async () => {
  const { mkdtempSync, cpSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { propose, listProposals } = await import('../src/proposals.js');
  const dir = mkdtempSync(join(tmpdir(), 'dc-ri-'));
  cpSync(orders, dir, { recursive: true });
  const before = readFileSync(join(dir, 'screens', 'order-list.yaml'), 'utf8');
  const p = await propose(dir, { screen: 'order-list', after: before.replace('kind: pagination', 'kind: pager') }, { branch: 'x', today: '2026-09-23' });
  const project = await loadProject(dir);
  const html = renderIndex(project, { branch: 'x', today: '2026-09-23', proposals: await listProposals(dir) });
  assert.match(html, new RegExp(`href="proposal-${p.id}\\.html"`));
});
