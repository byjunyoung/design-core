import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadProject } from '../src/index.js';
import { flowGraph, layoutFlows, nodeGeometry } from '../src/flowmap.js';
import { renderFlows } from '../src/render/index.js';

const mobile = fileURLToPath(new URL('../examples/mobile-app', import.meta.url));
const ops = fileURLToPath(new URL('../examples/store-ops', import.meta.url));

async function dirWith(files) {
  const dir = await mkdtemp(join(tmpdir(), 'doan-flows-'));
  for (const [name, body] of Object.entries(files)) {
    await mkdir(join(dir, name, '..'), { recursive: true });
    await writeFile(join(dir, name), body);
  }
  return dir;
}

test('flowGraph lists the edges that resolve, the ones that do not, and the screens no flow touches', async () => {
  const project = await loadProject(mobile);
  const g = flowGraph(project);
  assert.deepEqual(g.nodes.map((n) => n.screen).sort(), ['feed', 'item-detail', 'cart-sheet'].sort());
  assert.ok(g.edges.length >= 2);
  const e = g.edges.find((x) => x.screen === 'feed');
  assert.ok(e.target && e.state, 'every edge names a target screen and a state');
  assert.match(e.label, /tap/);
  assert.deepEqual(g.dead, []);
  assert.deepEqual(g.orphans, []);
});

test('a node is a thumbnail in the platform proportions with one row per state', async () => {
  const project = await loadProject(mobile);
  const feed = project.screens.find((s) => s.doc.screen === 'feed');
  const g = nodeGeometry(project, feed, ['Default', 'Empty', 'Loading']);
  assert.equal(g.thumb.w, 120);
  assert.equal(g.thumb.h, Math.round(844 * (120 / 390)));
  assert.equal(g.rows.length, 3);
  assert.ok(g.rows[1].y > g.rows[0].y);
  assert.ok(g.h > g.thumb.h + 3 * 18);
});

test('layoutFlows puts every screen in its section box and routes every edge to the row of the state it names, in page coordinates', async () => {
  const project = await loadProject(mobile);
  const map = await layoutFlows(project);
  assert.equal(map.ok, true);
  assert.equal(map.nodes.length, 3);
  assert.ok(map.width > 0 && map.height > 0);
  for (const n of map.nodes) {
    const sec = map.sections.find((s) => s.title === n.section);
    assert.ok(sec, `${n.screen} has a section box`);
    assert.ok(n.x >= sec.x && n.x + n.w <= sec.x + sec.w + 1, `${n.screen} sits inside its section`);
  }
  for (const e of map.edges) {
    assert.ok(e.points.length >= 2);
    const target = map.nodes.find((n) => n.screen === e.target);
    const row = target.rows.find((r) => r.name === e.state);
    const end = e.points[e.points.length - 1];
    assert.ok(Math.abs(end.x - target.x) < 3, `${e.id} ends at the target's left edge`);
    assert.ok(Math.abs(end.y - (target.y + row.y + 9)) < 3, `${e.id} ends at the "${e.state}" row`);
    // orthogonal: consecutive points share x or y
    for (let i = 1; i < e.points.length; i++) assert.ok(Math.abs(e.points[i].x - e.points[i - 1].x) < 0.01 || Math.abs(e.points[i].y - e.points[i - 1].y) < 0.01, `${e.id} bends at right angles`);
  }
});

test('without elkjs the map says so and still lists edges, dead ends and orphans', async () => {
  const project = await loadProject(mobile);
  const map = await layoutFlows(project, { elk: null });
  assert.equal(map.ok, false);
  assert.match(map.reason, /elkjs/);
  assert.ok(map.edges.length >= 2);
});

test('renderFlows draws section boxes, one node per screen with its thumbnail and state rows, and the edges as right-angle paths with labels', async () => {
  const project = await loadProject(mobile);
  const html = await renderFlows(project, { branch: 'x' });
  assert.equal((html.match(/class="flow-node"/g) ?? []).length, 3);
  assert.match(html, /class="flow-sec"[^>]*>\s*<div class="flow-sec-title">/);
  assert.match(html, /class="flow-node"[^>]*><a class="flow-head" href="feed\.html"/);
  assert.match(html, /class="flow-state"[^>]*>Default</);
  assert.match(html, /<path class="flow-edge[^"]*" d="M[\d.]+ [\d.]+ L/);
  assert.match(html, /<text class="flow-label"/);
  assert.match(html, /thumb-stage/);
  assert.match(html, /href="flows\.html"><span class="name">Flow map<\/span>/);
});

test('a project with dead ends and orphans lists them under the map; a conditional flow is dashed', async () => {
  const dir = await dirWith({
    'conventions.yaml': 'meta: { language: en }\nflows: { gestures: [tap], navs: [push] }\n',
    'sections.yaml': '- A\n- B\n',
    'screens/a.yaml': 'schema: doan/0.2\nid: scr_A\nscreen: a\nsection: A\ntype: page\nelements: [{ id: go, kind: button, label: Go }]\nflows:\n  - { from: go, to: b.Error, when: server down, style: conditional }\n  - { from: go, to: nowhere }\n',
    'screens/b.yaml': 'schema: doan/0.2\nid: scr_B\nscreen: b\nsection: B\ntype: page\nelements: [{ id: x, kind: caption, text: hi }]\nstates: { Error: [{ target: x, set: { text: oops } }] }\n',
    'screens/lonely.yaml': 'schema: doan/0.2\nid: scr_L\nscreen: lonely\nsection: B\ntype: page\nelements: []\n',
  });
  const project = await loadProject(dir);
  const html = await renderFlows(project);
  assert.match(html, /flow-edge conditional/);
  assert.match(html, /flow-dead[\s\S]*nowhere/);
  assert.match(html, /flow-orphans[\s\S]*lonely/);
});
