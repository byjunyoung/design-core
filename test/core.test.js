import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadProject, mergeState, resolveFlowTarget } from '../src/index.js';

const dir = fileURLToPath(new URL('../examples/orders', import.meta.url));

test('loadProject reads conventions, sections and every screen file', async () => {
  const project = await loadProject(dir);
  assert.equal(project.sections.length, 2);
  assert.deepEqual(project.screens.map((s) => s.doc.screen).sort(), ['order-detail', 'order-list']);
  assert.equal(project.conventions.lifecycle.canonical_branch, 'main');
});

test('a loaded screen can give the line of a YAML path', async () => {
  const project = await loadProject(dir);
  const list = project.screens.find((s) => s.doc.screen === 'order-list');
  assert.equal(list.lineOf(['screen']), 3);
  assert.equal(list.lineOf(['states', 'Empty', 1, 'target']), 34);
});

test('mergeState Default returns the elements untouched', async () => {
  const project = await loadProject(dir);
  const list = project.screens.find((s) => s.doc.screen === 'order-list').doc;
  const view = mergeState(list, 'Default');
  assert.deepEqual(view.elements.map((e) => e.id), ['header', 'filter', 'table', 'paging']);
});

test('mergeState Empty replaces the table and hides paging', async () => {
  const project = await loadProject(dir);
  const list = project.screens.find((s) => s.doc.screen === 'order-list').doc;
  const view = mergeState(list, 'Empty');
  const ids = view.elements.map((e) => e.id);
  assert.deepEqual(ids, ['header', 'filter', 'table']);
  const table = view.elements.find((e) => e.id === 'table');
  assert.equal(table.kind, 'empty-notice');
  assert.equal(table.text, 'No orders match.');
  assert.equal(view.layout.root.kind, 'stack');
});

test('mergeState reports a patch whose target does not exist', async () => {
  const project = await loadProject(dir);
  const list = project.screens.find((s) => s.doc.screen === 'order-list').doc;
  const broken = { ...list, states: { Odd: [{ target: 'ghost', hide: true }] } };
  const view = mergeState(broken, 'Odd');
  assert.deepEqual(view.missingTargets, ['ghost']);
});

test('resolveFlowTarget splits screen and state on the last dot', () => {
  const screens = [{ doc: { screen: 'order-list', states: { Empty: [] } } }, { doc: { screen: 'order-detail' } }];
  assert.deepEqual(resolveFlowTarget('order-detail', screens), { screen: 'order-detail', state: null });
  assert.deepEqual(resolveFlowTarget('order-list.Empty', screens), { screen: 'order-list', state: 'Empty' });
  assert.equal(resolveFlowTarget('order-list.Ghost', screens), null);
  assert.equal(resolveFlowTarget('nowhere', screens), null);
});

test('mergeState finds a patch target nested in children and in an element-valued prop', () => {
  const s = {
    elements: [
      { id: 'header', kind: 'page-header', actions: [{ id: 'export', kind: 'button', label: 'Export' }] },
      { id: 'card', kind: 'card', children: [{ id: 'table', kind: 'table' }, { id: 'paging', kind: 'pagination' }] },
    ],
    states: {
      Empty: [
        { target: 'table', replace: { kind: 'empty-notice' } },
        { target: 'paging', hide: true },
        { target: 'export', set: { disabled: true } },
      ],
    },
  };
  const view = mergeState(s, 'Empty');
  assert.deepEqual(view.missingTargets, []);
  const card = view.elements.find((e) => e.id === 'card');
  assert.deepEqual(card.children.map((e) => e.id), ['table']);
  assert.equal(card.children[0].kind, 'empty-notice');
  assert.equal(view.elements[0].actions[0].disabled, true);
});
