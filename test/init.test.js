import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { initProject, componentBases } from '../src/init.js';
import { loadProject } from '../src/index.js';
import { renderScreen } from '../src/render/index.js';
import { resolveAdapter } from '../src/render/adapters/index.js';

const fresh = () => mkdtempSync(join(tmpdir(), 'dc-init-'));

test('the list of component bases says which are ready and which are planned', () => {
  const bases = componentBases();
  assert.deepEqual(bases.find((b) => b.id === 'none'), { id: 'none', label: 'Self-built (100% yours)', status: 'ready', note: 'the bundled set is copied into your project and becomes your component library' });
  assert.equal(bases.find((b) => b.id === 'antd').status, 'ready');
  assert.ok(bases.every((b) => ['ready', 'planned', 'n/a'].includes(b.status)));
});

test('init --base none copies the component set into the project so the team owns it', async () => {
  const dir = fresh();
  const r = await initProject(dir, { base: 'none' });
  assert.ok(existsSync(join(dir, 'conventions.yaml')));
  assert.ok(existsSync(join(dir, 'sections.yaml')));
  assert.ok(existsSync(join(dir, 'tokens', 'theme.resolver.json')));
  assert.ok(existsSync(join(dir, 'components', 'kinds.js')));
  const conv = parse(readFileSync(join(dir, 'conventions.yaml'), 'utf8'));
  assert.equal(conv.render.base, 'none');
  assert.equal(conv.render.components, './components/kinds.js');
  assert.ok(!Object.values(conv.kinds).some((k) => k?.maps_to), 'self-built has no maps_to');
  assert.ok(r.created.length >= 4);
});

test('a project-owned component set is what render draws with, edits included', async () => {
  const dir = fresh();
  await initProject(dir, { base: 'none' });
  writeFileSync(join(dir, 'screens', 'demo.yaml'), 'schema: doan/0.2\nid: scr_D1\nscreen: demo\nsection: "01. Demo"\ntype: detail\nelements:\n  - id: b\n    kind: button\n    label: Go\n');
  writeFileSync(join(dir, 'sections.yaml'), '- "01. Demo"\n');
  const file = join(dir, 'components', 'kinds.js');
  writeFileSync(file, readFileSync(file, 'utf8').replace("return `<button class=\"btn btn-${h(variant)}\"", "return `<button class=\"btn our-own btn-${h(variant)}\""));
  const project = await loadProject(dir);
  const adapter = await resolveAdapter(project);
  const screen = project.screens.find((s) => s.doc.screen === 'demo');
  assert.match(renderScreen(project, screen, { adapter }), /our-own/);
});

test('init --base antd fills maps_to for the shipped kinds and names the base', async () => {
  const dir = fresh();
  await initProject(dir, { base: 'antd' });
  const conv = parse(readFileSync(join(dir, 'conventions.yaml'), 'utf8'));
  assert.equal(conv.render.base, 'antd');
  assert.equal(conv.kinds.table.maps_to.antd, 'Table');
  assert.ok(!existsSync(join(dir, 'components')));
});

test('init refuses a base it does not know, and refuses to overwrite an existing project', async () => {
  const dir = fresh();
  await assert.rejects(initProject(dir, { base: 'chakra' }), /unknown base/);
  await initProject(dir, { base: 'none' });
  await assert.rejects(initProject(dir, { base: 'none' }), /already/);
});


test('init leaves a starter screen that lints clean on a feature branch, and a project README', async () => {
  const dir = fresh();
  await initProject(dir, { base: 'none' });
  assert.ok(existsSync(join(dir, 'screens', 'sample-list.yaml')));
  assert.ok(existsSync(join(dir, 'README.md')));
  const { lintProject } = await import('../src/verbs.js');
  const { summary } = await lintProject(dir, { branch: 'feature/start', today: '2026-09-24' });
  assert.equal(summary.blocking, 0);
  assert.equal(summary.screens, 1);
});

test('mui is a ready base and shadcn says why it is not one', async () => {
  const bases = componentBases();
  assert.equal(bases.find((b) => b.id === 'mui').status, 'ready');
  assert.equal(bases.find((b) => b.id === 'shadcn').status, 'n/a');
  const dir = fresh();
  await initProject(dir, { base: 'mui' });
  const { parse } = await import('yaml');
  const { readFileSync } = await import('node:fs');
  const conv = parse(readFileSync(join(dir, 'conventions.yaml'), 'utf8'));
  assert.equal(conv.kinds.table.maps_to.mui, 'Table');
  assert.equal(conv.kinds.table.maps_to.antd, undefined);
  await assert.rejects(initProject(fresh(), { base: 'shadcn' }), /copied source/);
});

test('init writes DTCG token files with a light/dark resolver; resolved for light they are the bundled default, and the page carries both themes', async () => {
  const dir = fresh();
  await initProject(dir, { base: 'none' });
  for (const f of ['primitive.tokens.json', 'semantic.tokens.json', 'light.tokens.json', 'dark.tokens.json', 'theme.resolver.json']) assert.ok(existsSync(join(dir, 'tokens', f)), f);
  const project = await loadProject(dir);
  assert.equal(project.tokenSet.source, 'dtcg');
  assert.deepEqual(project.tokenSet.problems, []);
  assert.equal(project.tokens.color.primary, '#2f6fed');
  assert.equal(project.tokens.space.md, '16px');
  assert.equal(project.tokenSet.contexts.theme.dark.color.bg, '#1f2328');
  assert.match(project.tokenSet.origins['gray.0'], /primitive\.tokens\.json$/);
  const conv = parse(readFileSync(join(dir, 'conventions.yaml'), 'utf8'));
  assert.deepEqual(conv.tokens.primitive, ['primitive']);
  const screen = project.screens.find((s) => s.doc.screen === 'sample-list');
  const html = renderScreen(project, screen);
  assert.match(html, /:root\[data-theme="dark"\] \{[^}]*--color-bg: #1f2328;/);
  assert.match(html, /<select data-mode="theme"><option value="light" selected>light<\/option><option value="dark">dark<\/option><\/select>/);
});
