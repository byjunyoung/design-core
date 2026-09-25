import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readFile, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadProject } from '../src/index.js';
import { renderScreen } from '../src/render/index.js';

const ops = fileURLToPath(new URL('../examples/store-ops', import.meta.url));
const orders = fileURLToPath(new URL('../examples/orders', import.meta.url));

async function copyOf(src, edit) {
  const dir = await mkdtemp(join(tmpdir(), 'doan-truth-'));
  await cp(src, dir, { recursive: true });
  await edit(dir);
  return dir;
}
const screenHtml = async (dir, name) => {
  const project = await loadProject(dir);
  return renderScreen(project, project.screens.find((s) => s.doc.screen === name), { branch: 'x' });
};

test("the contract is the one truth: change a prop's default in components/<kind>.yaml and every element that left it out draws with it", async () => {
  const before = await screenHtml(orders, 'order-list');
  assert.match(before, /<div class="el el-button[^>]*data-id="export"[^>]*data-size="md"/);
  const dir = await copyOf(orders, async (d) => {
    const f = join(d, 'components', 'button.yaml');
    await writeFile(f, (await readFile(f, 'utf8')).replace(/(size:[\s\S]*?default: )md/, '$1full'));
  });
  const after = await screenHtml(dir, 'order-list');
  assert.match(after, /<div class="el el-button[^>]*data-id="export"[^>]*data-size="full"/);
  // and a default that reaches the drawing itself, not only the attribute: an image with no size
  const dir2 = await copyOf(ops, async (d) => {
    const f = join(d, 'components', 'image.yaml');
    await writeFile(f, (await readFile(f, 'utf8')).replace(/(size:[\s\S]*?default: )md/, '$1lg'));
  });
  const project = await loadProject(dir2);
  const shot = renderScreen(project, project.screens.find((s) => s.doc.screen === 'home'), { branch: 'x' });
  assert.doesNotMatch(shot, /class="img size-md"/);
});

test('an enum value the contract does not list is drawn as the declared default — the picture never invents a variant', async () => {
  const dir = await copyOf(orders, async (d) => {
    const f = join(d, 'screens', 'order-list.yaml');
    await writeFile(f, (await readFile(f, 'utf8')).replace('variant: secondary', 'variant: bogus'));
  });
  const html = await screenHtml(dir, 'order-list');
  assert.match(html, /<div class="el el-button[^>]*data-id="export"[^>]*data-variant="default"/);
  assert.match(html, /data-id="export"[^>]*>[^]*?<button class="btn btn-default"/);
  // what the file says is still what the inspector shows
  assert.match(html, /data-id="export"[^>]*data-props="[^"]*&quot;variant&quot;:&quot;bogus&quot;/);
});

test("a contract's token bindings reach a piece a library adapter draws: the CSS themes the adapter root from the same --k- variables", async () => {
  const html = await screenHtml(orders, 'order-list');
  assert.match(html, /\.el-button\[data-drawn\] > \* \{ background-color: var\(--k-button-bg\); color: var\(--k-button-text\); border-color: var\(--k-button-border\); border-radius: var\(--k-button-radius\); \}/);
  const { createAdapter } = await import('../src/render/adapters/index.js');
  const project = await loadProject(orders);
  const adapter = await createAdapter('antd', project);
  const drawn = renderScreen(project, project.screens.find((s) => s.doc.screen === 'order-list'), { branch: 'x', adapter });
  assert.match(drawn, /<div class="el el-button[^>]*data-id="export"[^>]*data-drawn="antd"/);
});
