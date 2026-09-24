import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffScreens, renderDiffMarkdown } from '../src/diff.js';

const before = {
  schema: 'doan/0.2', id: 'scr_1', screen: 'order-list', section: 'Orders', type: 'list',
  elements: [
    { id: 'filter', kind: 'filter-form', fields: ['period', 'branch'] },
    { id: 'table', kind: 'table', columns: ['a', 'b', 'c'] },
    { id: 'paging', kind: 'pagination' },
  ],
  layout: { root: { kind: 'stack', gap: 'space.lg' } },
  states: { Empty: [{ target: 'table', replace: { kind: 'empty-notice', text: 'None.' } }] },
  flows: [{ from: 'table', via: 'row', to: 'order-detail' }],
  notes: ['a'],
};

test('a changed prop on an element is reported by element id, not by index', () => {
  const after = structuredClone(before);
  after.elements[1].columns = ['a', 'c'];
  const d = diffScreens(before, after);
  assert.deepEqual(d.changed, [{ path: ['elements', 'table', 'columns'], before: ['a', 'b', 'c'], after: ['a', 'c'] }]);
  assert.deepEqual(d.added, []);
  assert.deepEqual(d.removed, []);
});

test('reordering elements is one entry, not a change per index', () => {
  const after = structuredClone(before);
  after.elements = [after.elements[1], after.elements[0], after.elements[2]];
  const d = diffScreens(before, after);
  assert.deepEqual(d.changed, [{ path: ['elements', '(order)'], before: ['filter', 'table', 'paging'], after: ['table', 'filter', 'paging'] }]);
});

test('an added state, a removed flow and a removed element each land in their list', () => {
  const after = structuredClone(before);
  after.states.Loading = [{ target: 'table', replace: { kind: 'skeleton' } }];
  after.flows = [];
  after.elements.splice(2, 1);
  const d = diffScreens(before, after);
  assert.deepEqual(d.added.map((e) => e.path), [['states', 'Loading']]);
  assert.deepEqual(d.removed.map((e) => e.path).sort(), [['elements', 'paging'], ['flows', 0]].sort());
});

test('identical screens diff to nothing', () => {
  const d = diffScreens(before, structuredClone(before));
  assert.deepEqual(d, { added: [], removed: [], changed: [] });
});

test('markdown output is an AS-IS / TO-BE table with one row per entry', () => {
  const after = structuredClone(before);
  after.elements[1].columns = ['a', 'c'];
  after.states.Loading = [];
  const md = renderDiffMarkdown(diffScreens(before, after), { screen: 'order-list' });
  assert.match(md, /^\| Where \| AS-IS \| TO-BE \|/m);
  assert.match(md, /elements\.table\.columns/);
  assert.match(md, /states\.Loading/);
  assert.equal(md.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Where')).length, 2);
});
