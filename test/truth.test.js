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

test('type, weight, height and shadow are slots too: a binding reaches a bundled piece through its wrapper and the css it reads, and an adapter root from outside', async () => {
  const dir = await copyOf(orders, async (d) => {
    const f = join(d, 'components', 'button.yaml');
    const text = await readFile(f, 'utf8');
    const next = text.replace('tokens:\n', 'tokens:\n  font-size: font.size.lg\n  font-weight: font.weight.bold\n  min-height: control.lg\n  shadow: shadow.sm\n');
    assert.notEqual(next, text);
    await writeFile(f, next);
  });
  const html = await screenHtml(dir, 'order-list');
  assert.match(html, /\.el-button \{[^}]*--k-button-font-size: var\(--font-size-lg\); --k-button-font-weight: var\(--font-weight-bold\); --k-button-min-height: var\(--control-lg\); --k-button-shadow: var\(--shadow-sm\)/);
  assert.match(html, /\.el-button\[data-drawn\] > \* \{[^}]*font-size: var\(--k-button-font-size\); font-weight: var\(--k-button-font-weight\); min-height: var\(--k-button-min-height\); box-shadow: var\(--k-button-shadow\)/);
  assert.match(html, /\.el-button:not\(\[data-drawn\]\) \{ font-size: var\(--k-button-font-size\); font-weight: var\(--k-button-font-weight\); \}/);
  assert.match(html, /\.btn \{[^}]*min-height: var\(--k-button-min-height, auto\); box-shadow: var\(--k-button-shadow, none\)/);
  assert.match(html, /--control-lg: 40px;/);
  assert.match(html, /--shadow-sm: 0px 1px 2px 0px #00000014;/);
  assert.match(html, /--font-weight-bold: 700;/);
  assert.match(html, /font: var\(--font-size-md, var\(--font-size, 14px\)\)/, 'the body reads the scale, or the one size a flat file still names');
});

test('L28: a binding to a slot the picture does not read is a warning that names the slots there are', async () => {
  const dir = await copyOf(orders, async (d) => {
    const f = join(d, 'components', 'button.yaml');
    await writeFile(f, (await readFile(f, 'utf8')).replace('tokens:\n', 'tokens:\n  colour: color.bg\n'));
  });
  const { lint } = await import('../src/lint.js');
  const l28 = lint(await loadProject(dir), { branch: null }).filter((f) => f.id === 'L28');
  assert.equal(l28.length, 1);
  assert.deepEqual(l28[0].path, ['tokens', 'colour']);
  assert.match(l28[0].message, /"colour" is not a slot the picture reads \(bg, .*font-size, font-weight, min-height, shadow, muted\)/);
});

test('the bundled set reads type from the contract where it used to fix a size: the page-header title, a field label, a hint; a segment and a stepper take a control height', async () => {
  const html = await screenHtml(orders, 'order-list');
  assert.match(html, /\.el-page-header h2 \{ font-size: var\(--k-page-header-font-size, 16px\); font-weight: var\(--k-page-header-font-weight, inherit\)/);
  assert.match(html, /\.fld \{[^}]*font-size: var\(--k-field-font-size, 12px\)/);
  assert.match(html, /\.el-hint \.hint \{ font-size: var\(--k-hint-font-size, 12px\); \}/);
  assert.match(html, /\.seg span \{[^}]*min-height: var\(--k-segment-min-height, auto\)/);
  assert.match(html, /\.stepper \{[^}]*min-height: var\(--k-stepper-min-height, auto\)/);
});

test('antd draws size: full as a block button and sm/md as small/middle, as the bundled set does', async () => {
  const dir = await copyOf(orders, async (d) => {
    const f = join(d, 'screens', 'order-list.yaml');
    await writeFile(f, (await readFile(f, 'utf8')).replace('label: Export, variant: secondary', 'label: Export, variant: secondary, size: full').replace('  - id: paging\n', '  - { id: dine, kind: segment, options: [A, B], selected: B }\n  - id: paging\n'));
  });
  const { createAdapter } = await import('../src/render/adapters/index.js');
  const project = await loadProject(dir);
  const adapter = await createAdapter('antd', project);
  const drawn = renderScreen(project, project.screens.find((s) => s.doc.screen === 'order-list'), { branch: 'x', adapter });
  assert.match(drawn, /data-id="export"[^>]*data-size="full"[^>]*data-drawn="antd"[^>]*><button[^>]*class="[^"]*ant-btn-block/);
  assert.match(drawn, /<span class="on">B<\/span>/, 'a segment draws its selected option, not always the first');
  assert.match(drawn, /\.el-card:not\(\[data-drawn\]\) \{ padding:/, 'the bundled card box does not wrap a card an adapter drew');
});

test('a list cell draws its value and hides the chevron when told — every prop of the contract reaches the picture', async () => {
  const dir = await copyOf(orders, async (d) => {
    const f = join(d, 'screens', 'order-list.yaml');
    await writeFile(f, (await readFile(f, 'utf8')).replace('  - id: paging\n', '  - { id: row, kind: list-cell, title: Americano, value: "4,500", chevron: false }\n  - { id: row2, kind: list-cell, title: Latte }\n  - id: paging\n'));
  });
  const html = await screenHtml(dir, 'order-list');
  assert.match(html, /data-id="row"[^>]*>[\s\S]*?<div class="cell-value">4,500<\/div><\/div><\/div>/);
  assert.match(html, /data-id="row2"[^>]*>[\s\S]*?<span class="cell-chevron">›<\/span>/);
});
