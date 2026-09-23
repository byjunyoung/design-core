import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
const examples = fileURLToPath(new URL('../examples/orders', import.meta.url));

test('lint --json prints findings and a summary, exit 0 when nothing blocks', async () => {
  const { stdout } = await run('node', [cli, 'lint', examples, '--branch', 'feature/demo', '--today', '2026-09-23', '--json']);
  const out = JSON.parse(stdout);
  assert.equal(out.summary.blocking, 0);
  assert.ok(Array.isArray(out.findings));
  assert.ok(out.findings.every((f) => f.file && f.path && f.id));
});

test('lint text output ends with a summary line and exits 1 on the canonical branch with a $tbd', async () => {
  await assert.rejects(
    run('node', [cli, 'lint', examples, '--branch', 'main', '--today', '2026-09-23']),
    (err) => {
      assert.equal(err.code, 1);
      assert.match(err.stdout, /L11/);
      assert.match(err.stdout.trim().split('\n').at(-1), /blocking/);
      return true;
    },
  );
});

test('an unknown verb exits 2 with usage', async () => {
  await assert.rejects(run('node', [cli, 'draw']), (err) => err.code === 2 && /usage/i.test(err.stderr));
});

test('prep via the CLI reports what it added and lint then counts the placeholders', async () => {
  const { mkdtempSync, writeFileSync, cpSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'dc-cli-'));
  cpSync(examples, dir, { recursive: true });
  const file = join(dir, 'screens', 'bare.yaml');
  writeFileSync(file, 'schema: design-core/0.2\nid: scr_T9\nscreen: bare\nsection: "03. Orders - Order list"\ntype: list\nelements:\n  - id: table\n    kind: table\n');
  const { stdout } = await run('node', [cli, 'prep', file, '--owner', 'design']);
  assert.match(stdout, /Empty, Loading, Error/);
  const lint = await run('node', [cli, 'lint', dir, '--branch', 'x', '--today', '2026-09-23', '--json']);
  const out = JSON.parse(lint.stdout);
  assert.equal(out.findings.filter((f) => f.id === 'L08' && f.screen === 'bare').length, 3);
  assert.equal(out.summary.blocking, 0);
});

test('diff via the CLI prints an AS-IS / TO-BE table between two files, and JSON on request', async () => {
  const { mkdtempSync, writeFileSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'dc-diff-'));
  const a = join(dir, 'a.yaml');
  const b = join(dir, 'b.yaml');
  const src = readFileSync(join(examples, 'screens', 'order-list.yaml'), 'utf8');
  writeFileSync(a, src);
  writeFileSync(b, src.replace('columns: [order_no, branch, amount, status, ordered_at]', 'columns: [order_no, amount, status, ordered_at]'));
  const { stdout } = await run('node', [cli, 'diff', a, b]);
  assert.match(stdout, /\| elements\.table\.columns \|/);
  const json = await run('node', [cli, 'diff', a, b, '--json']);
  assert.equal(JSON.parse(json.stdout).changed.length, 1);
});
