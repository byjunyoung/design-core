import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { prepFile } from '../src/prep.js';

const examples = fileURLToPath(new URL('../examples/orders', import.meta.url));

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dc-prep-'));
  cpSync(examples, dir, { recursive: true });
  return dir;
}

const bare = `schema: doan/0.2
id: scr_T1
screen: order-list   # keep this comment
section: "03. Orders - Order list"
type: list
elements:
  - id: table
    kind: table
states:
  Loading:
    - { target: table, replace: { kind: skeleton } }
`;

test('prep stubs every missing required state as a $tbd placeholder on the first element', async () => {
  const dir = sandbox();
  const file = join(dir, 'screens', 'bare.yaml');
  writeFileSync(file, bare);
  const result = await prepFile(file, { projectDir: dir, owner: 'design' });
  assert.deepEqual(result.added.sort(), ['Empty', 'Error']);
  const doc = parse(readFileSync(file, 'utf8'));
  assert.deepEqual(doc.states.Empty, [{ target: 'table', replace: { kind: 'placeholder', text: { $tbd: { owner: 'design', note: 'Empty state not designed yet' } } } }]);
  assert.ok(doc.states.Loading, 'existing states are kept');
});

test('prep keeps the comments and order of the file it rewrites', async () => {
  const dir = sandbox();
  const file = join(dir, 'screens', 'bare.yaml');
  writeFileSync(file, bare);
  await prepFile(file, { projectDir: dir });
  const text = readFileSync(file, 'utf8');
  assert.match(text, /# keep this comment/);
  assert.ok(text.indexOf('elements:') < text.indexOf('states:'));
});

test('prep is idempotent and honours --target', async () => {
  const dir = sandbox();
  const file = join(dir, 'screens', 'bare.yaml');
  writeFileSync(file, bare.replace('  - id: table\n    kind: table\n', '  - id: header\n    kind: page-header\n  - id: table\n    kind: table\n'));
  const first = await prepFile(file, { projectDir: dir, target: 'table' });
  assert.deepEqual(first.added.sort(), ['Empty', 'Error']);
  assert.equal(parse(readFileSync(file, 'utf8')).states.Error[0].target, 'table');
  const second = await prepFile(file, { projectDir: dir, target: 'table' });
  assert.deepEqual(second.added, []);
});

test('prep refuses a target that is not an element', async () => {
  const dir = sandbox();
  const file = join(dir, 'screens', 'bare.yaml');
  writeFileSync(file, bare);
  await assert.rejects(prepFile(file, { projectDir: dir, target: 'ghost' }), /not an element/);
});

test('prep on a type with no required row changes nothing', async () => {
  const dir = sandbox();
  const file = join(dir, 'screens', 'bare.yaml');
  writeFileSync(file, bare.replace('type: list', 'type: poster'));
  const before = readFileSync(file, 'utf8');
  const result = await prepFile(file, { projectDir: dir });
  assert.deepEqual(result.added, []);
  assert.equal(readFileSync(file, 'utf8'), before);
});
