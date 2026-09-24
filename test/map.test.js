import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { suggestFigmaMap, writeFigmaMap, masterNames } from '../src/import/map.js';
import { initProject } from '../src/init.js';

const file = {
  componentSets: { s1: { name: 'button' }, s2: { name: 'dropdown' }, s3: { name: 'table' }, s4: { name: 'navigation' } },
  components: {
    a: { name: 'type=primary', componentSetId: 's1' },
    b: { name: 'type=default', componentSetId: 's1' },
    c: { name: 'state=open', componentSetId: 's2' },
    d: { name: 'size=M', componentSetId: 's3' },
    e: { name: 'illustration_robot' },
    f: { name: 'pagination / default' },
    g: { name: 'section', componentSetId: 's4' },
  },
};

// the registry a project has after init: the bundled contracts as files
const registry = Object.fromEntries(readdirSync(new URL('../src/contracts', import.meta.url)).map((f) => [f.replace('.yaml', ''), parse(readFileSync(new URL(`../src/contracts/${f}`, import.meta.url), 'utf8'))]));

test('masterNames collapses variants into their set name and keeps loose components', () => {
  assert.deepEqual(masterNames(file).sort(), ['button', 'dropdown', 'illustration_robot', 'navigation', 'pagination / default', 'table']);
});

test('suggestFigmaMap pairs each kind with one master by name, and lists what it could not place', () => {
  const { mapped, unmatched, already } = suggestFigmaMap(masterNames(file), registry);
  assert.deepEqual(mapped.button, ['button']);
  assert.deepEqual(mapped.select, ['dropdown']);
  assert.deepEqual(mapped.table, ['table']);
  assert.deepEqual(mapped.pagination, ['pagination / default']);
  assert.deepEqual(mapped.image, ['illustration_robot']);
  assert.deepEqual(mapped.nav, ['navigation']);
  assert.deepEqual(unmatched, []);
  assert.deepEqual(already, {});
  // a conventions object from before 0.4 still works through its kinds rows
  const legacy = suggestFigmaMap(masterNames(file), { kinds: { button: {}, table: { maps_to: { figma: 'table' } } } });
  assert.deepEqual(legacy.mapped, { button: ['button'] });
  assert.deepEqual(legacy.already, { table: ['table'] });
});

test('writeFigmaMap puts maps_to.figma into components/<kind>.yaml without losing its comments, and reports what changed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dc-map-'));
  await initProject(dir, { base: 'antd' });
  const r = await writeFigmaMap(dir, { button: ['button', 'button / icon'], table: 'table', 'not-a-kind': 'x' });
  assert.deepEqual(r.written.sort(), ['button', 'table']);
  assert.deepEqual(r.skipped, ['not-a-kind']);
  const text = readFileSync(join(dir, 'components', 'button.yaml'), 'utf8');
  assert.match(text, /what the picture reads: slot → semantic token/, 'the contract keeps its comments');
  const button = parse(text);
  assert.deepEqual(button.maps_to.figma, ['button', 'button / icon']);
  assert.equal(button.maps_to.antd, 'Button', 'existing mappings to other libraries stay');
  assert.equal(parse(readFileSync(join(dir, 'components', 'table.yaml'), 'utf8')).maps_to.figma, 'table');
  assert.ok(!/^kinds:/m.test(readFileSync(join(dir, 'conventions.yaml'), 'utf8')), 'conventions.yaml is not touched');
  const again = await writeFigmaMap(dir, { button: 'button' });
  assert.deepEqual(again.written, []);
});

test('writeFigmaMap still writes into conventions.kinds for a project from before 0.4 that has no component file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dc-map-legacy-'));
  mkdirSync(join(dir, 'screens'));
  writeFileSync(join(dir, 'conventions.yaml'), '# team rules\nkinds:\n  button: { anchors: [] }\n');
  const r = await writeFigmaMap(dir, { button: 'button' });
  assert.deepEqual(r.written, ['button']);
  const conv = parse(readFileSync(join(dir, 'conventions.yaml'), 'utf8'));
  assert.equal(conv.kinds.button.maps_to.figma, 'button');
  assert.ok(!existsSync(join(dir, 'components', 'button.yaml')));
});
