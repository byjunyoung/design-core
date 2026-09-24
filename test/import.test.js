import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { importFigmaTree, writeImport } from '../src/import/figma.js';
import { initProject } from '../src/init.js';
import { lintProject } from '../src/verbs.js';

const file = JSON.parse(readFileSync(new URL('./fixtures/figma-file.json', import.meta.url), 'utf8'));
const conventions = parse(readFileSync(new URL('../conventions.example.yaml', import.meta.url), 'utf8'));
conventions.kinds.table.maps_to.figma = 'Table / default';
conventions.kinds.button.maps_to.figma = 'Button / Primary';
const tokens = { space: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' } };
const run = () => importFigmaTree(file, { page: '[UI] Orders', conventions, tokens, fileKey: 'ABC' });

test('frames named {screen}-{state} become one file per screen with the states as patches', () => {
  const { screens } = run();
  assert.deepEqual(screens.map((s) => s.doc.screen).sort(), ['order-detail', 'order-list']);
  const list = screens.find((s) => s.doc.screen === 'order-list').doc;
  assert.deepEqual(Object.keys(list.states).sort(), ['Empty', 'Error', 'Loading']);
  assert.equal(list.states.Error[0].replace.kind, 'placeholder', 'a required state the page never drew is stubbed');
  assert.equal(list.section, '03. Orders - Order list');
  assert.equal(list.refs.design, 'figma:ABC/3:1');
});

test('kinds come from maps_to.figma on the master name first, then from the name, and unresolved ones are $tbd', () => {
  const list = run().screens.find((s) => s.doc.screen === 'order-list').doc;
  const byId = Object.fromEntries(list.elements.map((e) => [e.id, e]));
  assert.equal(byId.table.kind, 'table');
  assert.deepEqual(byId.table.columns, ['Order no', 'Amount']);
  assert.equal(byId.header.children.find((c) => c.id === 'export').kind, 'button');
  assert.equal(byId.header.children.find((c) => c.id === 'export').label, 'Export');
  assert.equal(byId.filter.kind, 'filter-form');
  assert.deepEqual(byId.filter.fields, ['Period', 'Branch']);
  assert.equal(byId.paging.kind, 'pagination');
  assert.equal(byId['mystery-widget'].kind, 'frame');
  assert.equal(byId['mystery-widget'].resolve.$tbd.owner, 'import');
});

test('a state frame diffs against Default: a swapped instance is a replace, a missing element is a hide', () => {
  const list = run().screens.find((s) => s.doc.screen === 'order-list').doc;
  const empty = list.states.Empty;
  assert.deepEqual(empty.find((p) => p.target === 'table'), { target: 'table', replace: { kind: 'empty-notice', text: 'No orders match.' } });
  assert.deepEqual(empty.find((p) => p.target === 'paging'), { target: 'paging', hide: true });
  assert.deepEqual(list.states.Loading.find((p) => p.target === 'table'), { target: 'table', replace: { kind: 'skeleton' } });
});

test('auto-layout becomes layout with token names, never px; prototype links become flows; type is read off the states', () => {
  const list = run().screens.find((s) => s.doc.screen === 'order-list').doc;
  assert.deepEqual(list.layout.root, { kind: 'stack', direction: 'column', gap: 'space.lg', padding: 'space.xl' });
  assert.deepEqual(list.layout.header, { kind: 'stack', direction: 'row', gap: 'space.md' });
  assert.deepEqual(list.flows, [{ from: 'table', to: 'order-detail' }]);
  assert.equal(list.type, 'list');
  assert.match(JSON.stringify(list), /"\$tbd"/);
});

test('sections come from Figma sections; a frame outside a section lands in an import section; the result lints with 0 blocking', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dc-imp-'));
  await initProject(dir, { base: 'none' });
  const result = run();
  const written = await writeImport(dir, result);
  assert.ok(written.files.length === 2);
  assert.ok(existsSync(join(dir, 'screens', 'order-list.yaml')));
  const sections = parse(readFileSync(join(dir, 'sections.yaml'), 'utf8'));
  assert.ok(sections.includes('03. Orders - Order list'));
  const { summary } = await lintProject(dir, { branch: 'feature/import', today: '2026-09-24' });
  assert.equal(summary.blocking, 0);
  await assert.rejects(writeImport(dir, result), /exists/);
});

test('a page whose frames follow no naming convention still imports: every top-level frame is a screen, named by its own name and position', () => {
  const messy = {
    components: {},
    document: { children: [{ id: 'p', type: 'CANVAS', name: 'Messy', children: [
      { id: 'a', type: 'FRAME', name: 'pickupzone', children: [{ id: 'a1', type: 'GROUP', name: '3dots', children: [] }, { id: 'a2', type: 'TEXT', name: 't', characters: 'Hello' }] },
      { id: 'b', type: 'FRAME', name: 'pickupzone', children: [] },
      { id: 'c', type: 'SECTION', name: 'Archived', children: [{ id: 'c1', type: 'FRAME', name: 'old', children: [] }] },
    ] }] },
  };
  const conv = structuredClone(conventions);
  conv.pages = { exclude_sections: ['^Archived$'] };
  const { screens, fallback } = importFigmaTree(messy, { page: 'Messy', conventions: conv, tokens, fileKey: 'K' });
  assert.equal(fallback, true);
  assert.deepEqual(screens.map((s) => s.doc.screen), ['pickupzone', 'pickupzone-2']);
  assert.ok(screens[0].doc.notes.some((n) => /did not follow/.test(n)));
  assert.equal(screens[0].doc.elements.find((e) => e.id === 'n3dots').resolve.$tbd.owner, 'import');
});

test('an instance of a variant resolves through its component set name, not the variant name', () => {
  const f = structuredClone(file);
  f.componentSets = { 'set-btn': { name: 'button' } };
  f.components['c-btn'] = { name: 'type=primary, size=L', componentSetId: 'set-btn' };
  const conv = structuredClone(conventions);
  conv.kinds.button.maps_to.figma = 'button';
  const list = importFigmaTree(f, { page: '[UI] Orders', conventions: conv, tokens, fileKey: 'ABC' }).screens.find((s) => s.doc.screen === 'order-list').doc;
  assert.equal(list.elements.find((e) => e.id === 'header').children.find((c) => c.id === 'export').kind, 'button');
});


test('a run of instances of one master collapses into one element with repeat, and auto-named wrappers are groups without $tbd', () => {
  const f = {
    components: { tile: { name: 'graph-item' } },
    document: { children: [{ id: 'p', type: 'CANVAS', name: 'P', children: [
      { id: 'a', type: 'FRAME', name: 'home-Default', children: [
        { id: 'w', type: 'FRAME', name: 'Frame 483913', children: [
          ...Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, type: 'INSTANCE', name: 'graph-item', componentId: 'tile' })),
        ] },
      ] },
    ] }] },
  };
  const { screens } = importFigmaTree(f, { page: 'P', conventions, tokens, fileKey: 'K' });
  const home = screens[0].doc;
  const wrapper = home.elements[0];
  assert.equal(wrapper.kind, 'group');
  assert.equal(wrapper.resolve, undefined);
  assert.equal(wrapper.children.length, 1);
  assert.equal(wrapper.children[0].repeat, 12);
  assert.equal(wrapper.children[0].resolve.$tbd.owner, 'import', 'the master itself is still unresolved');
});

test('frame_pattern accepts a preset name: "screen/state" splits "Orders / Empty"', () => {
  const f = { components: {}, document: { children: [{ id: 'p', type: 'CANVAS', name: 'P', children: [
    { id: 'a', type: 'FRAME', name: 'Orders / Default', children: [] },
    { id: 'b', type: 'FRAME', name: 'Orders / Empty', children: [] },
  ] }] } };
  const conv = structuredClone(conventions);
  conv.naming.frame_pattern = 'screen/state';
  const { screens, fallback } = importFigmaTree(f, { page: 'P', conventions: conv, tokens, fileKey: 'K' });
  assert.equal(fallback, false);
  assert.deepEqual(screens.map((s) => s.doc.screen), ['Orders']);
  assert.ok(screens[0].doc.states.Empty);
});
