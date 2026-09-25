import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, cp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadProject } from '../src/index.js';
import { mergeState } from '../src/merge.js';
import { validateScreen, validateConventions } from '../src/validate.js';
import { lint } from '../src/lint.js';
import { renderScreen, renderProto } from '../src/render/index.js';
import { getScreen, listScreens } from '../src/verbs.js';

const ops = fileURLToPath(new URL('../examples/store-ops', import.meta.url));

async function opsWith(edit) {
  const dir = await mkdtemp(join(tmpdir(), 'doan-resp-'));
  await cp(ops, dir, { recursive: true });
  await edit(dir);
  return dir;
}

test('a breakpoint is patches applied last, on top of the state; the schema knows the block and the new layout words', () => {
  const doc = {
    schema: 'doan/0.2',
    id: 'scr_R1',
    screen: 'r',
    section: '01. A',
    type: 'list',
    elements: [{ id: 'grid', kind: 'section', children: [{ id: 'a', kind: 'caption', text: 'a' }] }, { id: 'strip', kind: 'stat-strip', stats: ['x'] }],
    layout: { grid: { kind: 'grid', columns: 3, gap: 'space.md' }, strip: { kind: 'row', gap: 'space.md' } },
    states: { Empty: [{ target: 'grid', replace: { kind: 'empty-notice', title: 'none' } }] },
    breakpoints: { mobile: [{ target: 'grid', layout: { columns: 'auto', min: 'sm' } }, { target: 'strip', layout: { scroll: 'horizontal' } }], tablet: [{ target: 'strip', layout: { wrap: true } }] },
  };
  assert.deepEqual(validateScreen(doc).errors, []);
  assert.deepEqual(validateConventions({ breakpoints: { mobile: 390, tablet: 768 } }).errors, []);
  const base = mergeState(doc, 'Default');
  assert.equal(base.layout.grid.columns, 3);
  const narrow = mergeState(doc, 'Default', {}, 'mobile');
  assert.deepEqual(narrow.layout.grid, { kind: 'grid', columns: 'auto', gap: 'space.md', min: 'sm' });
  assert.equal(narrow.layout.strip.scroll, 'horizontal');
  assert.equal(narrow.breakpoint, 'mobile');
  // the state first, the breakpoint on top: an Empty grid on mobile is the notice, and the strip still scrolls
  const both = mergeState(doc, 'Empty', {}, 'mobile');
  assert.equal(both.elements[0].kind, 'empty-notice');
  assert.equal(both.layout.strip.scroll, 'horizontal');
  assert.deepEqual(both.missingTargets, []); // replace keeps the id, so the breakpoint's patch still finds its target
});

test('the screen page draws a frame per breakpoint at that width, with the new layout words as CSS', async () => {
  const project = await loadProject(ops);
  const home = project.screens.find((s) => s.doc.screen === 'home');
  const html = renderScreen(project, home, { branch: 'x' });
  assert.match(html, /<span class="axis" style="margin-left:var\(--space-md\)">Breakpoints<\/span><button class="tab" data-state="bp=mobile" data-target="bp-mobile">mobile <span class="n">390<\/span><\/button><button class="tab" data-state="bp=tablet" data-target="bp-tablet">tablet <span class="n">768<\/span><\/button><button class="tab" data-state="bp=desktop" data-target="bp-desktop">desktop <span class="n">1280<\/span><\/button>/);
  const mobile = html.match(/<section class="state" id="bp-mobile">[^]*?<\/section>/)[0];
  assert.match(mobile, /<h3>mobile · 390px<\/h3>/);
  assert.match(mobile, /style="--ref-w:390px"/);
  assert.match(mobile, /class="tiles" style="--cols:10"/);
  assert.match(mobile, /overflow-x:auto;flex-wrap:nowrap/);
  const tablet = html.match(/<section class="state" id="bp-tablet">[^]*?<\/section>/)[0];
  assert.match(tablet, /style="--ref-w:768px"/);
  assert.match(tablet, /class="tiles" style="--cols:20"/);
  assert.match(tablet, /flex-wrap:wrap/);
  // the base frame keeps the platform width and the base grid
  const base = html.match(/<section class="state active" id="state-Default">[^]*?<\/section>/)[0];
  assert.match(base, /style="--ref-w:1280px"/);
  assert.match(base, /class="tiles" style="--cols:25"/);
  // a screen without a breakpoints block has no breakpoint tabs
  const list = project.screens.find((s) => s.doc.screen === 'inventory-list');
  assert.doesNotMatch(renderScreen(project, list, { branch: 'x' }), /data-target="bp-/);
});

test('columns: auto becomes an auto-fill grid with the min size class', async () => {
  const dir = await opsWith(async (d) => {
    const f = join(d, 'screens', 'home.yaml');
    await writeFile(f, (await readFile(f, 'utf8')).replace('overview: { kind: stack, direction: column, gap: space.md }', 'overview: { kind: grid, columns: auto, min: sm, gap: space.md }'));
  });
  const project = await loadProject(dir);
  const html = renderScreen(project, project.screens.find((s) => s.doc.screen === 'home'), { branch: 'x' });
  assert.match(html, /grid-template-columns:repeat\(auto-fill,minmax\(var\(--size-sm\),1fr\)\)/);
});

test('the prototype carries a view per breakpoint for screens that have them, and a select to pick one', async () => {
  const project = await loadProject(ops);
  const html = renderProto(project, { branch: 'x' });
  assert.match(html, /<select id="proto-bp" aria-label="Breakpoints"><option value="">base<\/option><option value="mobile">mobile 390<\/option><option value="tablet">tablet 768<\/option><option value="desktop">desktop 1280<\/option><\/select>/);
  assert.match(html, /<section class="proto-view" data-screen="home" data-state="Default" data-bp="mobile" hidden>/);
  assert.doesNotMatch(html, /data-screen="inventory-list" data-state="Default" data-bp=/);
  assert.match(html, /var bpSel = document\.getElementById\('proto-bp'\)/);
});

test('lint: L26 for a breakpoint conventions does not name, L07 for a breakpoint patch with no target, L18 for a breakpoint layout that names no token', async () => {
  const dir = await opsWith(async (d) => {
    const f = join(d, 'screens', 'home.yaml');
    await writeFile(f, (await readFile(f, 'utf8')).replace('  mobile:\n', '  phone:\n    - { target: nowhere, layout: { columns: 2 } }\n    - { target: stats, layout: { gap: nope.md } }\n  mobile:\n'));
  });
  const project = await loadProject(dir);
  const findings = lint(project, { branch: null }).filter((f) => f.screen === 'home');
  const by = (id) => findings.filter((f) => f.id === id);
  assert.deepEqual(by('L26').map((f) => f.path), [['breakpoints', 'phone']]);
  assert.match(by('L26')[0].message, /"phone" is not in conventions\.breakpoints \(mobile, tablet, desktop\)/);
  assert.deepEqual(by('L07').map((f) => f.path), [['breakpoints', 'phone', 0, 'target']]);
  assert.deepEqual(by('L18').map((f) => f.path), [['breakpoints', 'phone', 1, 'layout', 'gap']]);
  // the example itself is clean
  assert.equal(lint(await loadProject(ops), { branch: null }).filter((f) => ['L26', 'L07', 'L18'].includes(f.id)).length, 0);
});

test('get_screen takes a breakpoint and list_screens says which a screen has', async () => {
  const view = await getScreen(ops, { screen: 'home', breakpoint: 'mobile' });
  assert.equal(view.breakpoint, 'mobile');
  const tilesOf = (v) => v.elements.find((e) => e.id === 'overview').children.find((c) => c.id === 'tiles');
  assert.equal(tilesOf(view).columns, 10);
  assert.equal(view.layout.stats.scroll, 'horizontal');
  const plain = await getScreen(ops, { screen: 'home' });
  assert.equal(tilesOf(plain).columns, 25);
  const list = await listScreens(ops);
  assert.deepEqual(list.screens.find((s) => s.screen === 'home').breakpoints, ['desktop', 'tablet', 'mobile']);
  assert.deepEqual(list.screens.find((s) => s.screen === 'inventory-list').breakpoints, []);
});
