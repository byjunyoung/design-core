import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { propose, applyProposal, rejectProposal, undoProposal, listProposals } from '../src/proposals.js';

const examples = fileURLToPath(new URL('../examples/orders', import.meta.url));
const opts = { branch: 'feature/x', today: '2026-09-23' };

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dc-prop-'));
  cpSync(examples, dir, { recursive: true });
  return dir;
}
const read = (dir) => readFileSync(join(dir, 'screens', 'order-list.yaml'), 'utf8');

test('a text-only change that passes lint is applied at once, with undo', async () => {
  const dir = sandbox();
  const after = read(dir).replace('text: "No orders match."', 'text: "Nothing matches these filters."');
  const p = await propose(dir, { screen: 'order-list', after }, opts);
  assert.equal(p.tier, 'text');
  assert.equal(p.status, 'applied');
  assert.equal(p.auto, true);
  assert.match(read(dir), /Nothing matches these filters/);
  const u = await undoProposal(dir, { id: p.id });
  assert.equal(u.status, 'undone');
  assert.match(read(dir), /No orders match\./);
});

test('a structural change waits: pending, file untouched, diff and lint delta attached', async () => {
  const dir = sandbox();
  const after = read(dir).replace('columns: [order_no, branch, amount, status, ordered_at]', 'columns: [order_no, amount, status, ordered_at]');
  const p = await propose(dir, { screen: 'order-list', after }, opts);
  assert.equal(p.tier, 'structure');
  assert.equal(p.status, 'pending');
  assert.doesNotMatch(read(dir), /\[order_no, amount, status, ordered_at\]/);
  assert.deepEqual(p.diff.changed[0].path, ['elements', 'table', 'columns']);
  assert.match(p.markdown, /elements\.table\.columns/);
  assert.equal(p.lint.after.blocking, 0);
  const listed = await listProposals(dir);
  assert.deepEqual(listed.map((x) => x.id), [p.id]);
});

test('apply writes a pending proposal and records who approved; reject removes it', async () => {
  const dir = sandbox();
  const after = read(dir).replace('columns: [order_no, branch, amount, status, ordered_at]', 'columns: [order_no, amount, status, ordered_at]');
  const p = await propose(dir, { screen: 'order-list', after }, opts);
  const a = await applyProposal(dir, { id: p.id, approved_by: 'junyoung' });
  assert.equal(a.status, 'applied');
  assert.equal(a.approved_by, 'junyoung');
  assert.match(read(dir), /\[order_no, amount, status, ordered_at\]/);

  const q = await propose(dir, { screen: 'order-list', after: read(dir).replace('kind: pagination', 'kind: pager') }, opts);
  const r = await rejectProposal(dir, { id: q.id, reason: 'pager is not a kind' });
  assert.equal(r.status, 'rejected');
  assert.match(read(dir), /kind: pagination/);
  assert.equal((await listProposals(dir)).length, 0);
});

test('a text-only change that introduces a blocking finding is not auto-applied', async () => {
  const dir = sandbox();
  // renaming the screen is a "text" prop by name but breaks L01/L05 — must wait for a person
  const after = read(dir).replace('screen: order-list', 'screen: Order List');
  const p = await propose(dir, { screen: 'order-list', after }, opts);
  assert.equal(p.status, 'pending');
  assert.ok(p.lint.after.blocking > 0);
  assert.match(read(dir), /screen: order-list/);
});

test('a proposal that fails the schema is refused with the error, and nothing is stored', async () => {
  const dir = sandbox();
  await assert.rejects(propose(dir, { screen: 'order-list', after: read(dir).replace('elements:', 'elementz:') }, opts), /elements/);
  assert.equal(existsSync(join(dir, '.proposals')) ? (await listProposals(dir)).length : 0, 0);
});

test('apply refuses when the file changed since the proposal was made', async () => {
  const dir = sandbox();
  const base = read(dir);
  const p = await propose(dir, { screen: 'order-list', after: base.replace('columns: [order_no, branch, amount, status, ordered_at]', 'columns: [order_no, amount]') }, opts);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(dir, 'screens', 'order-list.yaml'), base.replace('title: Orders', 'title: All orders'));
  await assert.rejects(applyProposal(dir, { id: p.id, approved_by: 'x' }), /changed since/);
});

test('a proposal keeps the decisions agreed before it, and a decision without a why is still a decision', async () => {
  const dir = sandbox();
  const after = read(dir).replace('columns: [order_no, branch, amount, status, ordered_at]', 'columns: [order_no, amount, status, ordered_at]');
  const decisions = [
    { item: 'branch column', decision: 'drop it', why: 'single-store accounts never see a second branch' },
    { item: 'column order', decision: 'unchanged' },
  ];
  const p = await propose(dir, { screen: 'order-list', after, decisions }, opts);
  assert.deepEqual(p.decisions, decisions);
  const [listed] = await listProposals(dir);
  assert.equal(listed.decisions.length, 2);
});

test('propose takes a screen the project does not have: pending, the file appears on apply, undo removes it', async () => {
  const dir = sandbox();
  const section = read(dir).match(/^section: (.*)$/m)[1];
  const after = `schema: doan/0.2\nid: scr_NEWONE\nscreen: order-note\nsection: ${section}\ntype: detail\n\nelements:\n  - { id: title, kind: caption, style: title, text: Note }\n`;
  const p = await propose(dir, { screen: 'order-note', after }, opts);
  assert.equal(p.creates, true);
  assert.equal(p.tier, 'structure');
  assert.equal(p.status, 'pending');
  assert.equal(p.before, '');
  assert.match(p.file, /screens\/order-note\.yaml$/);
  assert.equal(existsSync(join(dir, 'screens', 'order-note.yaml')), false);
  assert.ok(p.diff.added.some((e) => e.path.join('.') === 'elements.title'), JSON.stringify(p.diff.added.map((e) => e.path)));
  const a = await applyProposal(dir, { id: p.id, approved_by: 'me' });
  assert.equal(a.status, 'applied');
  assert.equal(readFileSync(join(dir, 'screens', 'order-note.yaml'), 'utf8'), after);
  const u = await undoProposal(dir, { id: p.id });
  assert.equal(u.status, 'undone');
  assert.equal(existsSync(join(dir, 'screens', 'order-note.yaml')), false);
});

test('a new screen is refused when its name breaks naming.screen_pattern or the YAML names another screen', async () => {
  const dir = sandbox();
  const section = read(dir).match(/^section: (.*)$/m)[1];
  const body = (name) => `schema: doan/0.2\nid: scr_NEWTWO\nscreen: ${name}\nsection: ${section}\ntype: detail\n\nelements:\n  - { id: title, kind: caption, text: Note }\n`;
  await assert.rejects(propose(dir, { screen: 'Order Note', after: body('Order Note') }, opts), /screen_pattern/);
  await assert.rejects(propose(dir, { screen: 'order-note', after: body('order-memo') }, opts), /names screen "order-memo"/);
});

test('the proposal page draws a new screen against an empty AS-IS instead of failing on it', async () => {
  const dir = sandbox();
  const section = read(dir).match(/^section: (.*)$/m)[1];
  const after = `schema: doan/0.2\nid: scr_NEWTHREE\nscreen: order-note\nsection: ${section}\ntype: detail\n\nelements:\n  - { id: title, kind: caption, style: title, text: Note }\n`;
  const p = await propose(dir, { screen: 'order-note', after }, opts);
  const { loadProject } = await import('../src/index.js');
  const { renderProposal } = await import('../src/render/index.js');
  const html = renderProposal(await loadProject(dir), p, { branch: 'x' });
  assert.match(html, /A new screen — there is no AS-IS to compare\./);
  assert.match(html, /data-id="title"/);
});
