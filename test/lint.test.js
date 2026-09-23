import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { loadProject, lint } from '../src/index.js';

const examples = fileURLToPath(new URL('../examples/orders', import.meta.url));
const conventions = parse(readFileSync(new URL('../conventions.example.yaml', import.meta.url), 'utf8'));

// A minimal in-memory project. Each rule test starts from this and breaks one thing.
function screen(overrides = {}) {
  return {
    schema: 'design-core/0.2',
    id: 'scr_A1',
    screen: 'order-list',
    section: 'Orders',
    type: 'list',
    refs: { prd: 'notion:abc' },
    elements: [
      { id: 'table', kind: 'table', columns: ['a'] },
      { id: 'paging', kind: 'pagination' },
    ],
    layout: { root: { kind: 'stack', gap: 'space.lg' }, table: { grow: true } },
    states: {
      Empty: [{ target: 'table', replace: { kind: 'empty-notice', text: 'None.' } }],
      Loading: [{ target: 'table', replace: { kind: 'skeleton' } }],
      Error: [{ target: 'table', replace: { kind: 'error-notice', text: 'Failed.' } }],
    },
    flows: [{ from: 'table', via: 'row', to: 'order-detail' }],
    ...overrides,
  };
}
function project({ screens, conv = conventions, sections = ['Orders'] } = {}) {
  return {
    conventions: structuredClone(conv),
    sections,
    screens: screens.map((doc, i) => ({ file: `screens/${doc.screen}.yaml`, doc, lineOf: () => 1 + i })),
  };
}
const detail = () => screen({ id: 'scr_B2', screen: 'order-detail', type: 'detail', states: {}, flows: [], layout: {} });
const base = () => project({ screens: [screen(), detail()] });
const ids = (findings) => findings.map((f) => f.id);
const only = (findings, id) => findings.filter((f) => f.id === id);

test('the example project has no blocking findings on a feature branch', async () => {
  const findings = lint(await loadProject(examples), { branch: 'feature/demo', today: '2026-09-23' });
  assert.deepEqual(findings.filter((f) => f.severity === 'blocking'), []);
});

test('the base fixture is clean', () => {
  assert.deepEqual(ids(lint(base(), { branch: 'feature/x' })), []);
});

test('L01 fires on a screen name outside the pattern', () => {
  const p = project({ screens: [screen({ screen: 'Order List' }), detail()] });
  const f = only(lint(p, { branch: 'x' }), 'L01');
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, 'blocking');
  assert.deepEqual(f[0].path, ['screen']);
});

test('L01 is skipped when the pattern is null', () => {
  const p = project({ screens: [screen({ screen: 'Order List' }), detail()] });
  p.conventions.naming.screen_pattern = null;
  assert.equal(only(lint(p, { branch: 'x' }), 'L01').length, 0);
});

test('L02 fires when the section is not in sections.yaml', () => {
  const p = project({ screens: [screen({ section: 'Ghosts' }), detail()] });
  assert.equal(only(lint(p, { branch: 'x' }), 'L02').length, 1);
});

test('L03 fires once per missing required state', () => {
  const p = project({ screens: [screen({ states: { Empty: [] } }), detail()] });
  const f = only(lint(p, { branch: 'x' }), 'L03');
  assert.deepEqual(f.map((x) => x.message).sort(), ['Loading', 'Error'].map((s) => `list screen is missing the ${s} state`).sort());
});

test('L04 warns on a state outside states.known', () => {
  const p = project({ screens: [screen({ states: { ...screen().states, Weird: [] } }), detail()] });
  const f = only(lint(p, { branch: 'x' }), 'L04');
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, 'warning');
});

test('L05 fires when a flow points at a screen or state that does not exist', () => {
  const p = project({ screens: [screen({ flows: [{ from: 'table', to: 'order-detail.Ghost' }] }), detail()] });
  assert.equal(only(lint(p, { branch: 'x' }), 'L05').length, 1);
});

test('L06 warns when the source element or its anchor is unknown', () => {
  const p = project({ screens: [screen({ flows: [{ from: 'table', via: 'cell', to: 'order-detail' }, { from: 'ghost', to: 'order-detail' }] }), detail()] });
  assert.equal(only(lint(p, { branch: 'x' }), 'L06').length, 2);
});

test('L07 fires when a patch targets nothing', () => {
  const p = project({ screens: [screen({ states: { ...screen().states, Empty: [{ target: 'ghost', hide: true }] } }), detail()] });
  assert.equal(only(lint(p, { branch: 'x' }), 'L07').length, 1);
});

test('L08 warns on a $tbd anywhere and blocks when it is overdue', () => {
  const tbd = { $tbd: { owner: 'pm', due: '2026-10-02' } };
  const p = project({ screens: [screen({ elements: [{ id: 'table', kind: 'table', title: tbd }, { id: 'paging', kind: 'pagination' }] }), detail()] });
  const early = only(lint(p, { branch: 'x', today: '2026-09-23' }), 'L08');
  assert.equal(early.length, 1);
  assert.equal(early[0].severity, 'warning');
  const late = only(lint(p, { branch: 'x', today: '2026-10-03' }), 'L08');
  assert.equal(late[0].severity, 'blocking');
});

test('L09 warns when a required ref is missing', () => {
  const p = project({ screens: [screen({ refs: {} }), detail()] });
  p.conventions.refs.required = ['prd'];
  assert.equal(only(lint(p, { branch: 'x' }), 'L09').length, 1);
});

test('L10 warns on a kind not in conventions, in elements and in patches alike', () => {
  const p = project({ screens: [screen({ elements: [{ id: 'table', kind: 'hologram' }, { id: 'paging', kind: 'pagination' }], states: { ...screen().states, Empty: [{ target: 'table', replace: { kind: 'void' } }] } }), detail()] });
  assert.equal(only(lint(p, { branch: 'x' }), 'L10').length, 2);
});

test('L11 blocks a $tbd on the canonical branch and stays quiet elsewhere', () => {
  const tbd = { $tbd: { owner: 'pm' } };
  const p = project({ screens: [screen({ elements: [{ id: 'table', kind: 'table', title: tbd }, { id: 'paging', kind: 'pagination' }] }), detail()] });
  assert.equal(only(lint(p, { branch: 'main' }), 'L11').length, 1);
  assert.equal(only(lint(p, { branch: 'feature/x' }), 'L11').length, 0);
});

test('L12 fires on a duplicate screen id or name', () => {
  const p = project({ screens: [screen(), detail(), screen({ id: 'scr_C3' })] });
  assert.equal(only(lint(p, { branch: 'x' }), 'L12').length, 1);
});

test('L13 blocks layout values outside the vocabulary and any bare unit', () => {
  const p = project({ screens: [screen({ layout: { root: { kind: 'flexbox', gap: '16px' }, table: { size: 'huge' } } }), detail()] });
  const f = only(lint(p, { branch: 'x' }), 'L13');
  assert.equal(f.length, 3);
  assert.ok(f.every((x) => x.severity === 'blocking'));
});

test('L14 warns on a layout key that names no element, and exempts root', () => {
  const p = project({ screens: [screen({ layout: { root: { kind: 'stack' }, ghost: { grow: true } } }), detail()] });
  const f = only(lint(p, { branch: 'x' }), 'L14');
  assert.equal(f.length, 1);
  assert.deepEqual(f[0].path, ['layout', 'ghost']);
});

test('every finding carries file, path and line', () => {
  const p = project({ screens: [screen({ screen: 'Order List' }), detail()] });
  const [f] = only(lint(p, { branch: 'x' }), 'L01');
  assert.equal(f.file, 'screens/Order List.yaml');
  assert.equal(typeof f.line, 'number');
});

test('L06, L07 and L14 see elements nested in children and element-valued props', () => {
  const nested = screen({
    elements: [
      { id: 'header', kind: 'page-header', actions: [{ id: 'export', kind: 'button', label: 'Export' }] },
      { id: 'card', kind: 'card', children: [{ id: 'table', kind: 'table' }, { id: 'paging', kind: 'pagination' }] },
    ],
    layout: { root: { kind: 'stack' }, table: { grow: true }, export: { align: 'end' } },
    states: { ...screen().states, Empty: [{ target: 'table', replace: { kind: 'empty-notice' } }, { target: 'export', hide: true }] },
    flows: [{ from: 'table', via: 'row', to: 'order-detail' }, { from: 'export', to: 'order-detail' }],
  });
  const f = lint(project({ screens: [nested, detail()] }), { branch: 'x' });
  assert.deepEqual(ids(f).filter((id) => ['L06', 'L07', 'L14'].includes(id)), []);
});

test('an unquoted comma in a flow-style value surfaces as a schema finding with a hint', async () => {
  const { validateScreen } = await import('../src/index.js');
  const { parse } = await import('yaml');
  const doc = parse('flows:\n  - { from: a, to: b, when: Cancel, X or backdrop }\n');
  const r = validateScreen({ ...screen(), flows: doc.flows });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /X or backdrop/.test(e.message) && /quote/i.test(e.message)));
});
