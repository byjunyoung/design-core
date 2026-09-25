import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadProject } from '../src/index.js';
import { domainOf, slugOf, canvasPages, happyPathOrder } from '../src/canvas.js';
import { renderCanvas } from '../src/render/index.js';

const mobile = fileURLToPath(new URL('../examples/mobile-app', import.meta.url));

async function dirWith(files) {
  const dir = await mkdtemp(join(tmpdir(), 'doan-canvas-'));
  for (const [name, body] of Object.entries(files)) {
    await mkdir(join(dir, name, '..'), { recursive: true });
    await writeFile(join(dir, name), body);
  }
  return dir;
}

test('a section "NN. domain - feature" names its domain; a section with no dash is its own domain', () => {
  assert.deepEqual(domainOf('01. 카페 키오스크 - 주문'), { domain: '카페 키오스크', feature: '주문' });
  assert.deepEqual(domainOf('03. Orders - Order list'), { domain: 'Orders', feature: 'Order list' });
  assert.deepEqual(domainOf('01. Shop'), { domain: 'Shop', feature: null });
  assert.deepEqual(domainOf('00. Sample - delete me'), { domain: 'Sample', feature: 'delete me' });
  assert.equal(slugOf('카페 키오스크'), '카페-키오스크');
  assert.equal(slugOf('In-store display'), 'in-store-display');
});

test('canvasPages groups sections by domain in sections.yaml order and puts the happy path first inside a section', async () => {
  const dir = await dirWith({
    'conventions.yaml': 'meta: { language: en }\nstates: { known: [Default, Empty, Loading, Error] }\n',
    'sections.yaml': '- "01. Orders - List"\n- "01. Orders - Detail"\n- "02. Settings"\n',
    'screens/order-detail.yaml': 'schema: doan/0.2\nid: scr_D\nscreen: order-detail\nsection: "01. Orders - Detail"\ntype: detail\nelements: [{ id: back, kind: button, label: Back }]\nflows: [{ from: back, to: order-list }]\n',
    'screens/order-list.yaml': 'schema: doan/0.2\nid: scr_L\nscreen: order-list\nsection: "01. Orders - List"\ntype: list\nelements: [{ id: table, kind: table }, { id: new, kind: button, label: New }]\nstates: { Empty: [{ target: table, hide: true }], Loading: [{ target: table, hide: true }], Error: [{ target: table, hide: true }] }\nflows: [{ from: table, to: order-detail }, { from: new, to: order-new }]\n',
    'screens/order-new.yaml': 'schema: doan/0.2\nid: scr_N\nscreen: order-new\nsection: "01. Orders - List"\ntype: form\nelements: [{ id: save, kind: button, label: Save }]\nflows: [{ from: save, to: order-list }]\n',
    'screens/settings.yaml': 'schema: doan/0.2\nid: scr_S\nscreen: settings\nsection: "02. Settings"\ntype: page\nelements: []\n',
  });
  const project = await loadProject(dir);
  const pages = canvasPages(project);
  assert.deepEqual(pages.map((p) => [p.domain, p.slug, p.sections.map((s) => s.name)]), [
    ['Orders', 'orders', ['01. Orders - List', '01. Orders - Detail']],
    ['Settings', 'settings', ['02. Settings']],
  ]);
  const list = pages[0].sections[0];
  assert.deepEqual(list.screens.map((s) => s.screen), ['order-list', 'order-new'], 'the entry screen first, then what it reaches; a back-flow does not make order-new the entry');
  assert.deepEqual(list.screens[0].states, ['Default', 'Empty', 'Loading', 'Error']);
});

test('happyPathOrder falls back to file order when a section has no flows', async () => {
  const project = await loadProject(mobile);
  const cart = project.screens.filter((s) => s.doc.section === '02. Cart');
  assert.deepEqual(happyPathOrder(project, cart).map((s) => s.doc.screen), ['cart-sheet']);
});

test('renderCanvas draws one frame per screen state in its section box, at real size, with the flows as data and the canvas script', async () => {
  const project = await loadProject(mobile);
  const [shop] = canvasPages(project);
  assert.equal(shop.domain, 'Shop');
  const html = renderCanvas(project, shop, { branch: 'x' });
  const frames = project.screens.filter((s) => s.doc.section === '01. Shop').reduce((n, s) => n + 1 + Object.keys(s.doc.states ?? {}).length, 0);
  assert.equal((html.match(/class="cv-frame"/g) ?? []).length, frames);
  assert.match(html, /<div class="cv-section" data-section="01\. Shop"><div class="cv-section-title">01\. Shop<\/div>/);
  assert.match(html, /<div class="cv-frame" data-screen="feed" data-state="Refreshing"[^>]*><a class="cv-frame-title" href="feed\.html#state-Refreshing">feed-Refreshing<\/a>/);
  assert.match(html, /class="cv-stage/);
  assert.doesNotMatch(html, /class="stage /, 'the page fitter must not touch canvas frames');
  assert.match(html, /window\.DOAN_FLOWS = \[/);
  assert.match(html, /window\.DOAN_CANVAS = \{"domain":"Shop","screens":\["feed","item-detail"\]\}/);
  assert.match(html, /id="cv-arrows"/);
  assert.match(html, /<div class="shell workspace">/);
  assert.match(html, /<div class="tree-domain open current" data-domain="shop"><div class="tree-domain-head"><span class="caret"><\/span><a class="name" href="canvas-shop\.html">Shop<\/a><span class="hint">2<\/span><\/div>/);
  assert.match(html, /<div class="tree-domain" data-domain="cart"><div class="tree-domain-head"><span class="caret"><\/span><a class="name" href="canvas-cart\.html">Cart<\/a><span class="hint">1<\/span>/);
  assert.match(html, /<a class="tree-frame" data-screen="feed" data-state="Refreshing" href="canvas-shop\.html#feed\.Refreshing">Refreshing<\/a><div class="tree-layers" data-screen="feed" data-state="Refreshing">/);
  assert.match(html, /id="tree-search"/);
  assert.match(html, /<nav class="views"><a class="current" href="canvas-shop\.html">Canvas<\/a><a class="" href="proto\.html#feed">Prototype<\/a><\/nav>/);
  assert.doesNotMatch(html, /<a class="side-link" href="flows\.html">/, "the sidebar navigates content; the modes live on the top bar");
  assert.match(html, /data-screen="feed" data-state="Default" data-type="feed" data-platform="ios" data-file="feed\.yaml"/);
  assert.match(html, /<aside id="inspector" class="drawer"><div class="hint">Click an element to inspect it\.<\/div>/);
});

test('the overview and the prototype arrive with no placed domain and fold the tree from their hash; the canvas is placed by the server', async () => {
  const { renderIndex, renderProto } = await import('../src/render/index.js');
  const project = await loadProject(mobile);
  const [shop] = canvasPages(project);
  const flows = await renderIndex(project, { branch: 'x' });
  const proto = await renderProto(project, { branch: 'x' });
  for (const html of [flows, proto]) {
    assert.doesNotMatch(html, /class="tree-domain open current"/);
    assert.match(html, /window\.doanTreeFollow = treeFollow/);
  }
  // the prototype tells the tree where it went, since replaceState fires no hashchange
  assert.match(proto, /window\.doanTreeFollow\(\)/);
  assert.match(renderCanvas(project, shop, { branch: 'x' }), /class="tree-domain open current" data-domain="shop"/);
});

test('the shell folds for narrow windows: a menu button and a panel button on every page, and media queries that hide the sidebar and the panel', async () => {
  const project = await loadProject(mobile);
  const [shop] = canvasPages(project);
  const { renderIndex, renderTokens } = await import('../src/render/index.js');
  for (const html of [renderCanvas(project, shop, { branch: 'x' }), await renderIndex(project, { branch: 'x' }), renderTokens(project, { branch: 'x' })]) {
    assert.match(html, /<header class="top"><div class="where"[^>]*><button class="btn side-toggle" id="side-toggle" type="button" aria-label="Menu">☰<\/button><h1>/);
    assert.match(html, /<div class="tools"><button class="btn panel-toggle" id="panel-toggle" type="button">Panel<\/button>/);
    assert.match(html, /@media \(max-width: 1180px\) \{\s*\.shell\.workspace \{ grid-template-columns: var\(--side-w\) minmax\(0, 1fr\) 0; \}/);
    assert.match(html, /@media \(max-width: 860px\) \{\s*\.shell\.workspace \{ grid-template-columns: minmax\(0, 1fr\) 0; \}/);
    assert.match(html, /window\.doanPanelOpen = function \(\)/);
  }
});
