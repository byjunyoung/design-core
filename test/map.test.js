import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
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

test('masterNames collapses variants into their set name and keeps loose components', () => {
  assert.deepEqual(masterNames(file).sort(), ['button', 'dropdown', 'illustration_robot', 'navigation', 'pagination / default', 'table']);
});

test('suggestFigmaMap pairs each kind with one master by name, and lists what it could not place', () => {
  const conventions = parse(readFileSync(new URL('../conventions.example.yaml', import.meta.url), 'utf8'));
  const { mapped, unmatched, already } = suggestFigmaMap(masterNames(file), conventions);
  assert.deepEqual(mapped.button, ['button']);
  assert.deepEqual(mapped.select, ['dropdown']);
  assert.deepEqual(mapped.table, ['table']);
  assert.deepEqual(mapped.pagination, ['pagination / default']);
  assert.deepEqual(mapped.image, ['illustration_robot']);
  assert.deepEqual(mapped.nav, ['navigation']);
  assert.deepEqual(unmatched, []);
  assert.deepEqual(already, {});
});

test('writeFigmaMap puts maps_to.figma into conventions.yaml without losing its comments, and reports what changed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dc-map-'));
  await initProject(dir, { base: 'antd' });
  const r = await writeFigmaMap(dir, { button: ['button', 'button / icon'], table: 'table', 'not-a-kind': 'x' });
  assert.deepEqual(r.written.sort(), ['button', 'table']);
  assert.deepEqual(r.skipped, ['not-a-kind']);
  const text = readFileSync(join(dir, 'conventions.yaml'), 'utf8');
  assert.match(text, /the rules one team writes for itself/);
  const conv = parse(text);
  assert.deepEqual(conv.kinds.button.maps_to.figma, ['button', 'button / icon']);
  assert.equal(conv.kinds.table.maps_to.figma, 'table');
  assert.equal(conv.kinds.button.maps_to.antd, 'Button', 'existing mappings to other libraries stay');
  const again = await writeFigmaMap(dir, { button: 'button' });
  assert.deepEqual(again.written, []);
});
