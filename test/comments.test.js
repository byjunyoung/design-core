import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addComment, listComments, resolveComment } from '../src/comments.js';

const examples = fileURLToPath(new URL('../examples/orders', import.meta.url));
const sandbox = () => { const d = mkdtempSync(join(tmpdir(), 'dc-cm-')); cpSync(examples, d, { recursive: true }); return d; };

test('a comment is anchored to a screen and a YAML path, and comes back in order', async () => {
  const dir = sandbox();
  const a = await addComment(dir, { screen: 'order-list', path: 'elements.1', text: 'drop the branch column', author: 'junyoung' });
  const b = await addComment(dir, { screen: 'order-list', path: 'states.Empty.0', text: 'warmer copy please', author: 'pm' });
  assert.match(a.id, /^c_/);
  const open = await listComments(dir, { screen: 'order-list' });
  assert.deepEqual(open.map((c) => c.id), [a.id, b.id]);
  assert.equal(open[0].path, 'elements.1');
  assert.equal(open[0].resolved, false);
});

test('resolving a comment keeps it, marks who and why, and drops it from the open list', async () => {
  const dir = sandbox();
  const a = await addComment(dir, { screen: 'order-list', path: 'elements.1', text: 'x', author: 'a' });
  const r = await resolveComment(dir, { id: a.id, by: 'agent', note: 'applied in p_123' });
  assert.equal(r.resolved, true);
  assert.equal(r.resolved_by, 'agent');
  assert.deepEqual(await listComments(dir, { screen: 'order-list' }), []);
  assert.equal((await listComments(dir, { screen: 'order-list', status: 'all' })).length, 1);
});

test('a comment on a screen that does not exist is refused', async () => {
  const dir = sandbox();
  await assert.rejects(addComment(dir, { screen: 'ghost', path: 'elements.0', text: 'x', author: 'a' }), /ghost/);
});

test('a comment is anchored by element id: its path follows the element when one is inserted above, and it is orphaned when the element goes', async () => {
  const { readFile, writeFile } = await import('node:fs/promises');
  const dir = sandbox();
  const c = await addComment(dir, { screen: 'order-list', path: 'elements.1', text: 'the filter', author: 'me' });
  assert.equal(typeof c.element, 'string');
  const file = join(dir, 'screens', 'order-list.yaml');
  const text = await readFile(file, 'utf8');
  // an element inserted at the top: the path moves to elements.2, the id stays
  await writeFile(file, text.replace('elements:\n', 'elements:\n  - { id: banner, kind: caption, text: New }\n'));
  const [moved] = await listComments(dir, { screen: 'order-list' });
  assert.equal(moved.element, c.element);
  assert.equal(moved.path, 'elements.2');
  assert.equal(moved.orphan, false);
  assert.ok(moved.line > c.line);
  // the element removed: the comment keeps its last path and says it is orphaned
  await writeFile(file, text.replace(/  - id: filter[\s\S]*?(?=\n  - id: )/, ''));
  const [gone] = await listComments(dir, { screen: 'order-list' });
  assert.equal(gone.orphan, true);
  assert.equal(gone.element, c.element);
});

test('a comment can be added by element id, and one from before ids gets its id on read', async () => {
  const { readFile, writeFile } = await import('node:fs/promises');
  const dir = sandbox();
  const c = await addComment(dir, { screen: 'order-list', element: 'table', text: 'sort by date', author: 'me' });
  assert.equal(c.element, 'table');
  assert.match(c.path, /^elements\.\d+$/);
  await assert.rejects(addComment(dir, { screen: 'order-list', element: 'nope', text: 'x', author: 'me' }), /no element "nope"/);
  // a legacy record: path only
  const f = join(dir, '.comments', 'order-list.json');
  const list = JSON.parse(await readFile(f, 'utf8'));
  list.push({ id: 'c_legacy1', screen: 'order-list', path: c.path, line: 1, text: 'old', author: 'old', created: '2026-09-01T00:00:00.000Z', resolved: false });
  await writeFile(f, JSON.stringify(list));
  const legacy = (await listComments(dir, { screen: 'order-list' })).find((x) => x.id === 'c_legacy1');
  assert.equal(legacy.element, 'table');
});
