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
