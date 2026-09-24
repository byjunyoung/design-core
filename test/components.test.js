import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { readFileSync } from 'node:fs';
import { loadComponents, elementProps, enumAttrs } from '../src/components.js';
import { validateComponent } from '../src/validate.js';
import { loadProject } from '../src/index.js';

const contracts = fileURLToPath(new URL('../src/contracts', import.meta.url));
const orders = fileURLToPath(new URL('../examples/orders', import.meta.url));

async function dirWith(files) {
  const dir = await mkdtemp(join(tmpdir(), 'doan-components-'));
  for (const [name, body] of Object.entries(files)) {
    await mkdir(join(dir, name, '..'), { recursive: true });
    await writeFile(join(dir, name), body);
  }
  return dir;
}

test('the three hand-written contracts pass the component schema', () => {
  for (const name of ['button', 'card', 'table']) {
    const doc = parse(readFileSync(join(contracts, `${name}.yaml`), 'utf8'));
    const r = validateComponent(doc);
    assert.deepEqual(r.errors, [], name);
  }
});

test('the schema rejects an unknown top-level key, a prop of unknown type, and a binding that is not a token name', () => {
  assert.ok(validateComponent({ kind: 'x', colour: 'red' }).errors.length);
  assert.ok(validateComponent({ kind: 'x', props: { a: { type: 'colour' } } }).errors.length);
  assert.ok(validateComponent({ kind: 'x', tokens: { bg: '#fff' } }).errors.length);
  assert.deepEqual(validateComponent({ kind: 'x', tokens: { bg: 'color.bg' } }).errors, []);
});

test('components/*.yaml become the registry; the kind defaults to the file stem; conventions.kinds rows without a file are read as legacy', async () => {
  const dir = await dirWith({
    'components/button.yaml': 'kind: button\nprops: { label: { type: string, required: true } }\ntokens: { bg: color.bg }\n',
    'components/stemmed.yaml': 'description: no kind field\n',
    'components/kinds.js': 'export const kinds = {};\n', // the self-built drawing set lives here too; not a contract
  });
  const { registry, legacy, problems, files } = await loadComponents(dir, { kinds: { button: { anchors: [] }, table: { anchors: ['row'], maps_to: { antd: 'Table' } } } });
  assert.deepEqual(problems, []);
  assert.equal(files.length, 2);
  assert.equal(registry.button.props.label.required, true);
  assert.equal(registry.button.legacy, undefined); // the file wins over the conventions row
  assert.match(registry.button.file, /components\/button\.yaml$/);
  assert.equal(registry.stemmed.kind, 'stemmed');
  assert.equal(registry.table.legacy, true);
  assert.deepEqual(registry.table.anchors, ['row']);
  assert.deepEqual(legacy, ['table']);
});

test('an unreadable contract is a problem naming the file, and the rest still loads', async () => {
  const dir = await dirWith({ 'components/ok.yaml': 'kind: ok\n', 'components/bad.yaml': 'kind: [\n' });
  const { registry, problems } = await loadComponents(dir);
  assert.ok(registry.ok);
  assert.ok(problems.some((p) => /bad\.yaml$/.test(p.file)));
});

test('loadProject exposes the registry as project.components: the migrated example has files, a project from before 0.4 has only legacy rows', async () => {
  const project = await loadProject(orders);
  assert.equal(project.componentSet.files.length, 9);
  assert.equal(project.components.table.legacy, undefined);
  assert.deepEqual(project.components.table.anchors, ['row', 'header']);
  assert.deepEqual(project.componentSet.legacy, []);
  const legacy = await dirWith({
    'conventions.yaml': 'meta: { language: en }\nkinds:\n  table: { anchors: [row, header] }\n',
    'sections.yaml': '- A\n',
    'screens/x.yaml': 'schema: doan/0.2\nid: scr_X\nscreen: x\nsection: A\ntype: page\nelements: []\n',
  });
  const old = await loadProject(legacy);
  assert.equal(old.componentSet.files.length, 0);
  assert.equal(old.components.table.legacy, true);
  assert.deepEqual(old.componentSet.legacy, ['table']);
});

test('elementProps drops the reserved keys; enumAttrs reads enum props with their defaults', () => {
  const contract = parse(readFileSync(join(contracts, 'button.yaml'), 'utf8'));
  assert.deepEqual(elementProps({ id: 'b', kind: 'button', label: 'Go', variant: 'primary', show_when: 'x', children: [] }), { label: 'Go', variant: 'primary' });
  assert.deepEqual(enumAttrs(contract, { id: 'b', kind: 'button', label: 'Go' }), { variant: 'default', size: 'md', disabled: 'false' });
  assert.deepEqual(enumAttrs(contract, { id: 'b', kind: 'button', label: 'Go', variant: 'danger', size: 'full' }), { variant: 'danger', size: 'full', disabled: 'false' });
});

// --- lint over instances ---------------------------------------------------------------

import { lint } from '../src/index.js';
import { renderScreen } from '../src/render/index.js';

const exampleConventions = parse(readFileSync(new URL('../conventions.example.yaml', import.meta.url), 'utf8'));
function inMemory({ elements, states = {}, components, componentSet = null, dir = null }) {
  const doc = { schema: 'doan/0.2', id: 'scr_C1', screen: 'demo', section: 'A', type: 'page', elements, states };
  return { dir, conventions: structuredClone(exampleConventions), sections: ['A'], screens: [{ file: 'screens/demo.yaml', doc, lineOf: () => 1 }], components, componentSet, tokens: null, tokenSet: { origins: {}, problems: [] } };
}
const button = { ...parse(readFileSync(join(contracts, 'button.yaml'), 'utf8')), file: '/x/components/button.yaml' };
const card = { ...parse(readFileSync(join(contracts, 'card.yaml'), 'utf8')), file: '/x/components/card.yaml' };

test('L21 warns on a prop the contract does not declare — on elements, on replace patches and on set patches — and says nothing for a contract without props', () => {
  const p = inMemory({
    elements: [{ id: 'b', kind: 'button', label: 'Go', colour: 'red' }, { id: 'x', kind: 'legacyish', anything: 1 }],
    states: { Empty: [{ target: 'b', set: { tone: 'loud' } }, { target: 'x', replace: { kind: 'button', label: 'Again', shape: 'pill' } }] },
    components: { button, legacyish: { kind: 'legacyish', legacy: true, file: null } },
  });
  const f = lint(p).filter((x) => x.id === 'L21');
  assert.deepEqual(f.map((x) => x.path.join('.')), ['elements.0.colour', 'states.Empty.0.set.tone', 'states.Empty.1.replace.shape']);
  assert.equal(f[0].severity, 'warning');
  assert.match(f[0].message, /components\/button\.yaml/);
});

test('L22 blocks a missing required prop, an enum value the kind does not have, and a slot the kind does not declare', () => {
  const p = inMemory({
    elements: [
      { id: 'a', kind: 'button' },
      { id: 'b', kind: 'button', label: 'Go', variant: 'ghost' },
      { id: 'c', kind: 'card', slots: { footer: { id: 'f', kind: 'caption', text: 'x' } } },
      { id: 'd', kind: 'button', label: 'Fine', variant: 'danger', size: 'full' },
    ],
    components: { button, card },
  });
  const f = lint(p).filter((x) => x.id === 'L22');
  assert.deepEqual(f.map((x) => x.path.join('.')), ['elements.0', 'elements.1.variant', 'elements.2.slots.footer']);
  assert.ok(f.every((x) => x.severity === 'blocking'));
});

test('L23 is one warning per project naming how many kinds still sit in conventions.kinds, and nothing when the registry is all files', () => {
  const p = inMemory({ elements: [], components: { button }, componentSet: { legacy: ['table', 'nav'], problems: [] }, dir: '/x' });
  const f = lint(p).filter((x) => x.id === 'L23');
  assert.equal(f.length, 1);
  assert.equal(f[0].file, '/x/conventions.yaml');
  assert.match(f[0].message, /2 kind/);
  p.componentSet.legacy = [];
  assert.equal(lint(p).filter((x) => x.id === 'L23').length, 0);
});

test('a contract binding that names no token is L18 on the component file; one that names a primitive is L19', () => {
  const p = inMemory({ elements: [], components: { button: { ...button, tokens: { bg: 'color.nope' }, variants: { variant: { primary: { bg: 'gray.0' } } } } } });
  p.tokens = { gray: { 0: '#fff' } };
  p.tokenSet = { origins: { 'gray.0': '/x/tokens/primitive.tokens.json' }, problems: [] };
  const l18 = lint(p).filter((x) => x.id === 'L18');
  assert.equal(l18.length, 1);
  assert.equal(l18[0].file, '/x/components/button.yaml');
  assert.deepEqual(l18[0].path, ['tokens', 'bg']);
  const l19 = lint(p).filter((x) => x.id === 'L19');
  assert.equal(l19.length, 1);
  assert.deepEqual(l19[0].path, ['variants', 'variant', 'primary', 'bg']);
});

test('the picture reads the contract: bindings become --k-<kind>-<slot> on the wrapper, enum props become data attributes, variants bind on them', async () => {
  const dir = await dirWith({
    'conventions.yaml': 'meta: { language: en }\n',
    'sections.yaml': '- A\n',
    'components/button.yaml': readFileSync(join(contracts, 'button.yaml'), 'utf8').replace('bg: color.bg', 'bg: color.surface'),
    'screens/demo.yaml': 'schema: doan/0.2\nid: scr_D\nscreen: demo\nsection: A\ntype: page\nelements:\n  - { id: go, kind: button, label: Go, variant: primary }\n  - { id: plain, kind: button, label: Plain }\n',
  });
  const project = await loadProject(dir);
  const html = renderScreen(project, project.screens[0]);
  assert.match(html, /\.el-button \{ --k-button-bg: var\(--color-surface\); --k-button-text: var\(--color-text\); --k-button-border: var\(--color-border\); --k-button-radius: var\(--radius-sm\); \}/);
  assert.match(html, /\.el-button\[data-variant="primary"\] \{ --k-button-bg: var\(--color-primary\); --k-button-text: var\(--color-primary-text\); --k-button-border: var\(--color-primary\); \}/);
  assert.match(html, /data-id="go"[^>]* data-variant="primary" data-size="md"/);
  assert.match(html, /data-id="plain"[^>]* data-variant="default" data-size="md"/);
  assert.match(html, /\.btn \{[^}]*background: var\(--k-button-bg, var\(--color-bg\)\)/);
});

test('lintProject reports a contract that fails the schema as a SCHEMA finding on that file', async () => {
  const { lintProject } = await import('../src/verbs.js');
  const dir = await dirWith({
    'conventions.yaml': 'meta: { language: en }\n',
    'sections.yaml': '- A\n',
    'components/button.yaml': 'kind: button\nprops: { label: { type: colour } }\n',
    'screens/demo.yaml': 'schema: doan/0.2\nid: scr_D\nscreen: demo\nsection: A\ntype: page\nelements: []\n',
  });
  const { findings } = await lintProject(dir, { branch: 'x' });
  assert.ok(findings.some((f) => f.id === 'SCHEMA' && /button\.yaml$/.test(f.file)));
});

// --- compound components --------------------------------------------------------------

import { expandComponents } from '../src/expand.js';
import { mergeState } from '../src/index.js';

const MENU_CARD = `kind: menu-card
description: One menu on the kiosk board.
props:
  name: { type: string, required: true }
  price: { type: string, required: true }
  soldout: { type: boolean, default: false }
slots: [badge]
tokens: { bg: color.bg, border: color.border, radius: radius.md }
elements:
  - { id: image, kind: image, size: sm }
  - { id: name, kind: caption, style: title, text: $name }
  - { id: price, kind: caption, style: strong, text: $price, show_when: '!soldout' }
  - { id: soldout, kind: tag, text: "\${name} — sold out", show_when: soldout }
  - { slot: badge }
layout:
  root: { kind: stack, direction: column, gap: space.sm, padding: space.md }
  image: { size: full }
`;
const KIOSK = `schema: doan/0.2
id: scr_K
screen: kiosk
section: A
type: page
elements:
  - id: grid
    kind: group
    children:
      - { id: menu-1, kind: menu-card, name: 아메리카노, price: "4,500원" }
      - { id: menu-2, kind: menu-card, name: 카페라떼, price: "5,000원", slots: { badge: { id: menu-2-badge, kind: tag, text: NEW } } }
layout:
  grid: { kind: grid, columns: 2, gap: space.md }
  menu-2: { grow: true }
states:
  SoldOut:
    - { target: menu-2, set: { soldout: true } }
`;

test('expandComponents turns an instance into its contract tree: $prop substituted, props settle show_when, slots filled, ids prefixed, layout merged', () => {
  const registry = { 'menu-card': { ...parse(MENU_CARD), file: '/x/components/menu-card.yaml' } };
  const screen = parse(KIOSK);
  const d = expandComponents(mergeState(screen, 'Default'), registry);
  const [m1, m2] = d.elements[0].children;
  assert.equal(m1.$expanded, true);
  assert.deepEqual(m1.children.map((c) => c.id), ['menu-1/image', 'menu-1/name', 'menu-1/price']); // no slot given, not sold out
  assert.equal(m1.children[1].text, '아메리카노');
  assert.equal(m1.children[2].show_when, undefined); // settled, not carried as a condition
  assert.deepEqual(m1.children[1].$from, { file: 'components/menu-card.yaml', path: 'elements.1' });
  assert.deepEqual(m2.children.map((c) => c.id), ['menu-2/image', 'menu-2/name', 'menu-2/price', 'menu-2-badge']);
  assert.equal(m2.slots, undefined);
  assert.deepEqual(d.layout['menu-1'], { kind: 'stack', direction: 'column', gap: 'space.sm', padding: 'space.md' });
  assert.deepEqual(d.layout['menu-2'], { kind: 'stack', direction: 'column', gap: 'space.sm', padding: 'space.md', grow: true }); // the screen's rule wins on the outside
  assert.deepEqual(d.layout['menu-2/image'], { size: 'full' });

  const s = expandComponents(mergeState(screen, 'SoldOut'), registry);
  const sold = s.elements[0].children[1];
  assert.deepEqual(sold.children.map((c) => c.id), ['menu-2/image', 'menu-2/name', 'menu-2/soldout', 'menu-2-badge']);
  assert.equal(sold.children[2].text, '카페라떼 — sold out');
});

test('a compound renders as a container of its tree, with the contract layout and its bindings, and the inspector path names the component file', async () => {
  const dir = await dirWith({ 'conventions.yaml': 'meta: { language: en }\n', 'sections.yaml': '- A\n', 'components/menu-card.yaml': MENU_CARD, 'screens/kiosk.yaml': KIOSK });
  const project = await loadProject(dir);
  const html = renderScreen(project, project.screens[0]);
  assert.match(html, /data-id="menu-1"[^>]*data-kind="menu-card"[^>]*style="display:flex;flex-direction:column;gap:var\(--space-sm\);padding:var\(--space-md\)"/);
  assert.match(html, /data-id="menu-1\/name"[^>]*data-path="components\/menu-card\.yaml › elements\.1"/);
  assert.match(html, /아메리카노/);
  assert.match(html, /\.el-menu-card \{ --k-menu-card-bg: var\(--color-bg\)/);
  assert.doesNotMatch(html, /el-unknown[^>]*data-kind="menu-card"/);
  assert.match(html, /id="state-SoldOut"[\s\S]*data-id="menu-2\/soldout"/);
  const l = lint(project).filter((f) => f.severity === 'blocking');
  assert.deepEqual(l, []);
});

test('the library page draws every contract from its sample, one picture per variant option, with props and bindings, and the sidebar links to it', async () => {
  const { renderLibrary } = await import('../src/render/index.js');
  const project = await loadProject(orders);
  const html = renderLibrary(project, { branch: 'x' });
  assert.match(html, /<section class="lib" id="k-button">/);
  assert.match(html, /data-id="sample-button"[^>]*data-kind="button"/);
  assert.match(html, /variant = primary[\s\S]*data-id="sample-button-variant-primary"[^>]*data-variant="primary"/);
  assert.match(html, /<code>label<\/code> <span class="pill tbd">required<\/span>/);
  assert.match(html, /<code>bg<\/code> <span class="hint">variant=primary<\/span><\/td><td><code>color\.primary<\/code>/);
  assert.match(html, /href="components\.html"><span class="name">Components<\/span><span class="hint">9<\/span>/);
  // a compound draws from its own elements
  const dir = await dirWith({ 'conventions.yaml': 'meta: { language: ko }\n', 'sections.yaml': '- A\n', 'components/menu-card.yaml': MENU_CARD + 'sample: { name: 아메리카노, price: "4,500원" }\n', 'screens/kiosk.yaml': KIOSK });
  const kiosk = await loadProject(dir);
  const lib = renderLibrary(kiosk);
  assert.match(lib, /복합 — 자기 elements로 그림/);
  assert.match(lib, /data-id="sample-menu-card\/name"[\s\S]*아메리카노/);
});
