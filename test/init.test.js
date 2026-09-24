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
  assert.ok(bases.some((b) => b.status === 'planned'));
});

test('init --base none copies the component set into the project so the team owns it', async () => {
  const dir = fresh();
  const r = await initProject(dir, { base: 'none' });
  assert.ok(existsSync(join(dir, 'conventions.yaml')));
  assert.ok(existsSync(join(dir, 'sections.yaml')));
  assert.ok(existsSync(join(dir, 'tokens.json')));
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
  writeFileSync(join(dir, 'screens', 'demo.yaml'), 'schema: design-core/0.2\nid: scr_D1\nscreen: demo\nsection: "01. Demo"\ntype: detail\nelements:\n  - id: b\n    kind: button\n    label: Go\n');
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

test('init refuses a base that is only planned, and refuses to overwrite an existing project', async () => {
  const dir = fresh();
  await assert.rejects(initProject(dir, { base: 'mui' }), /planned/);
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
