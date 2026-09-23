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
