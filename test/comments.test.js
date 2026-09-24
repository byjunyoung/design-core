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
