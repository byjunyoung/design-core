import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadProject } from '../src/index.js';
import { specOf, specMarkdown, codeOf } from '../src/spec.js';
import { tokensCss, tokensTailwind } from '../src/export.js';
import { DEFAULT_TOKEN_FILES } from '../src/tokens.js';
import { lint } from '../src/lint.js';
import { renderSpec, renderScreen } from '../src/render/index.js';
import { specScreen, exportTokens, listScreens } from '../src/verbs.js';

const orders = fileURLToPath(new URL('../examples/orders', import.meta.url));
const ops = fileURLToPath(new URL('../examples/store-ops', import.meta.url));

async function copyOf(src, edit) {
  const dir = await mkdtemp(join(tmpdir(), 'doan-spec-'));
  await cp(src, dir, { recursive: true });
  if (edit) await edit(dir);
  return dir;
}
const screenOf = (project, name) => project.screens.find((s) => s.doc.screen === name);

test('the spec reads a screen off the file: elements with code, copy, states as changes, flows, tokens, components, open questions, acceptance', async () => {
  const project = await loadProject(orders);
  const spec = specOf(project, screenOf(project, 'order-list'), { branch: 'x' });
  assert.equal(spec.screen, 'order-list');
  assert.equal(spec.status, 'draft');
  assert.equal(spec.file, 'screens/order-list.yaml', 'paths in the spec are project-relative: a ticket travels');
  assert.ok(spec.components.every((c) => !c.file || c.file.startsWith('components/')));
  const btn = spec.elements.find((e) => e.id === 'export');
  assert.equal(btn.kind, 'button');
  assert.equal(btn.parent, 'header');
  assert.deepEqual(btn.code, { import: '@acme/ui', name: 'Button', props: { kind: 'secondary' }, snippet: '<Button kind="secondary">Export</Button>', note: null });
  assert.ok(spec.copy.some((c) => c.element === 'export' && c.prop === 'label' && c.text === 'Export'));
  assert.ok(spec.states.some((s) => s.name === 'Empty' && s.required && s.changes.some((c) => c.target === 'table' && /becomes empty-notice/.test(c.change))));
  assert.ok(spec.tokens.some((t) => t.name === 'space.lg' && t.css === '--space-lg' && t.value === '24px' && t.usedAt.some((a) => a.startsWith('layout.'))));
  assert.ok(spec.tokens.some((t) => t.usedAt.some((a) => a.startsWith('button.'))), 'contract bindings count as use');
  assert.ok(spec.components.some((c) => c.kind === 'button' && c.maps_to.code?.name === 'Button'));
  assert.ok(spec.acceptance.some((a) => /Empty: table becomes empty-notice/.test(a.text) && a.source === 'states.Empty'));
  assert.ok(spec.acceptance[0].text.startsWith('the screen has every state its type requires'));
  assert.ok(spec.flows.length >= 1 && spec.acceptance.some((a) => a.source.startsWith('flows.')));
  assert.equal(typeof spec.lint.blocking, 'number');
});

test('codeOf translates props and values by the contract mapping and writes a neutral snippet; no mapping, no code', () => {
  const contract = { kind: 'button', maps_to: { antd: 'Button', code: { import: '@acme/ui', name: 'Btn', props: { label: 'children', variant: 'kind' }, values: { variant: { danger: 'destructive' } } } } };
  assert.equal(codeOf(contract, { id: 'x', kind: 'button', label: 'Delete', variant: 'danger', disabled: true }).snippet, '<Btn kind="destructive" disabled>Delete</Btn>');
  assert.equal(codeOf({ kind: 'button', maps_to: { antd: 'Button' } }, { id: 'x', kind: 'button', label: 'Go' }), null);
});

test('the markdown spec is a ticket: title, acceptance checklist, element table with the code snippet', async () => {
  const md = await specScreen(orders, { screen: 'order-list', format: 'md' });
  assert.match(md, /^# order-list — developer spec/);
  assert.match(md, /## Acceptance\n\n- \[ \] the screen has every state/);
  assert.match(md, /\| export \| button \| <Button kind="secondary">Export<\/Button> \|/);
  assert.match(md, /## Tokens used/);
});

test('tokens export: css custom properties with a block per non-default context, and a tailwind theme.extend', async () => {
  const dir = await copyOf(ops, async (d) => {
    await mkdir(join(d, 'tokens'), { recursive: true });
    for (const [name, body] of Object.entries(DEFAULT_TOKEN_FILES)) await writeFile(join(d, 'tokens', name), JSON.stringify(body));
  });
  const project = await loadProject(dir);
  const css = tokensCss(project);
  assert.match(css, /^:root \{\n  --space-xs: 4px;/);
  assert.match(css, /  --gray-0: #ffffff;/);
  assert.match(css, /\[data-theme="dark"\] \{\n(  --[a-z0-9-]+: [^\n]+;\n)*  --color-bg: #1f2328;/);
  assert.doesNotMatch(css.split('[data-theme="dark"]')[1], /--space-md/);
  const tw = tokensTailwind(project);
  assert.match(tw, /"spacing": \{\n\s+"xs": "4px"/);
  assert.match(tw, /"colors": \{[^}]*"primary": "#2f6fed"/);
  assert.match(tw, /"fontFamily": \{\n\s+"sans": \[/);
  assert.match(await exportTokens(orders, { format: 'css' }), /^:root \{/);
  await assert.rejects(exportTokens(orders, { format: 'scss' }), /unknown token format/);
});

test('a screen marked ready with an open $tbd gets L27; list_screens carries the status', async () => {
  const dir = await copyOf(orders, async (d) => {
    const f = join(d, 'screens', 'order-list.yaml');
    const text = await readFile(f, 'utf8');
    await writeFile(f, text.replace('type: list', 'type: list\nstatus: ready').replace('label: Export', 'label: { $tbd: { owner: pm } }'));
  });
  const project = await loadProject(dir);
  const l27 = lint(project, { branch: null }).filter((f) => f.id === 'L27');
  assert.equal(l27.length, 1);
  assert.deepEqual(l27[0].path, ['status']);
  assert.match(l27[0].message, /"ready" but \d+ \$tbd remain/);
  assert.equal((await listScreens(dir)).screens.find((s) => s.screen === 'order-list').status, 'ready');
  assert.ok(specOf(project, screenOf(project, 'order-list')).tbd.some((t) => t.owner === 'pm'));
});

test('proposing status: ready is a text-tier change — it applies at once, as the draw prompt promises', async () => {
  const dir = await copyOf(orders);
  const { propose } = await import('../src/proposals.js');
  const f = join(dir, 'screens', 'order-list.yaml');
  const text = await readFile(f, 'utf8');
  const p = await propose(dir, { screen: 'order-list', after: text.replace('type: list', 'type: list\nstatus: ready'), summary: 'ready for developers' });
  assert.equal(p.tier, 'text');
  assert.equal(p.status, 'applied');
  assert.match(await readFile(f, 'utf8'), /^status: ready$/m);
});

test('the spec page: acceptance checkboxes, the elements table with code, a copy-as-markdown button, the spec embedded as JSON; the screen page links to it and carries the code snippet for the inspector', async () => {
  const project = await loadProject(orders);
  const screen = screenOf(project, 'order-list');
  const html = renderSpec(project, screen, { branch: 'x' });
  assert.match(html, /<h1>order-list <span class="hint">Spec<\/span><\/h1>/);
  assert.match(html, /<ul class="list acceptance"><li><label><input type="checkbox"> the screen has every state/);
  assert.match(html, /<code>&lt;Button kind=&quot;secondary&quot;&gt;Export&lt;\/Button&gt;<\/code><div class="hint">@acme\/ui<\/div>/);
  assert.match(html, /<button class="btn" id="spec-copy-md" type="button">Copy as Markdown<\/button>/);
  assert.match(html, /<template id="spec-md"># order-list — developer spec/);
  assert.match(html, /<script type="application\/json" id="spec-json">\{"screen":"order-list"/);
  assert.match(html, /03\. Orders - Order list · list · web · draft/);
  const page = renderScreen(project, screen, { branch: 'x' });
  assert.match(page, /<a class="btn" href="spec-order-list\.html">developer spec<\/a>/);
  assert.match(page, /"specFor":"developer spec"/, 'the canvas frame panel can name the spec link');
  assert.match(page, /data-id="export"[^>]*data-code="&lt;Button kind=&quot;secondary&quot;&gt;Export&lt;\/Button&gt;"/);
});
