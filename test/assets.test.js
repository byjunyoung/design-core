import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadProject } from '../src/index.js';
import { isAssetRef, assetFile, loadAssets, assetRefs, assetsSummary } from '../src/assets.js';
import { lint } from '../src/lint.js';
import { renderScreen, renderAssets } from '../src/render/index.js';
import { listAssets } from '../src/verbs.js';

const ops = fileURLToPath(new URL('../examples/store-ops', import.meta.url));
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';
const SCREEN = `schema: doan/0.2
id: scr_ASSETS1
screen: assets-demo
section: "02. Inventory"
type: detail
elements:
  - id: hero
    kind: image
    src: assets/photos/hero.jpg
    alt: The shop
  - id: tip
    kind: hint
    icon: assets/icons/cart.svg
    text: Tap to add
  - id: plain
    kind: hint
    icon: "★"
    text: A glyph stays a glyph
states:
  Loading:
    - { target: tip, set: { icon: assets/icons/spinner.svg } }
`;

// store-ops plus an assets/ folder: two icons (one never named), a photo, a stray text file,
// and a screen that names a photo, an icon, a glyph and — in one state — an icon that does not exist
async function projectWithAssets() {
  const dir = await mkdtemp(join(tmpdir(), 'doan-assets-'));
  await cp(ops, dir, { recursive: true });
  await mkdir(join(dir, 'assets', 'icons'), { recursive: true });
  await mkdir(join(dir, 'assets', 'photos'), { recursive: true });
  await writeFile(join(dir, 'assets', 'icons', 'cart.svg'), SVG);
  await writeFile(join(dir, 'assets', 'icons', 'unused.svg'), SVG);
  await writeFile(join(dir, 'assets', 'photos', 'hero.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  await writeFile(join(dir, 'assets', 'notes.txt'), 'not an asset');
  await writeFile(join(dir, 'screens', 'assets-demo.yaml'), SCREEN);
  return dir;
}

test('an asset reference is a path under assets/ with a picture extension; a glyph, a text file or a path outside stay what they are', () => {
  assert.equal(isAssetRef('assets/icons/cart.svg'), true);
  assert.equal(isAssetRef('assets/Photo.JPG'), true);
  assert.equal(isAssetRef('★'), false);
  assert.equal(isAssetRef('assets/notes.txt'), false);
  assert.equal(isAssetRef('../assets/x.svg'), false);
  assert.equal(isAssetRef('icons/cart.svg'), false);
  assert.equal(isAssetRef({ $tbd: {} }), false);
});

test('a served asset URL resolves inside assets/ and nowhere else, percent-encoding included', () => {
  const dir = '/p/design';
  assert.equal(assetFile(dir, '/assets/icons/cart.svg'), '/p/design/assets/icons/cart.svg');
  assert.equal(assetFile(dir, '/assets/%EC%95%84%EC%9D%B4%EC%BD%98.svg'), '/p/design/assets/아이콘.svg');
  assert.equal(assetFile(dir, '/assets/../conventions.yaml'), null);
  assert.equal(assetFile(dir, '/assets/..%2Fconventions.yaml'), null);
  assert.equal(assetFile(dir, '/assets/%E0%A4%A'), null);
});

test('loadAssets lists every picture under assets/ recursively, sorted, and nothing else; no folder is an empty list', async () => {
  const dir = await projectWithAssets();
  const files = await loadAssets(dir);
  assert.deepEqual(
    files.map((a) => [a.path, a.type]),
    [
      ['assets/icons/cart.svg', 'image/svg+xml'],
      ['assets/icons/unused.svg', 'image/svg+xml'],
      ['assets/photos/hero.jpg', 'image/jpeg'],
    ],
  );
  assert.equal(files[0].bytes, SVG.length);
  assert.deepEqual(await loadAssets(ops), []);
});

test('assetRefs finds every src and icon that names an asset — Default elements and state patches — and assetsSummary says who uses what, what is missing and what is unused', async () => {
  const dir = await projectWithAssets();
  const project = await loadProject(dir);
  const refs = assetRefs(project).filter((r) => r.screen === 'assets-demo');
  assert.deepEqual(
    refs.map((r) => [r.path, r.at.join('.')]),
    [
      ['assets/photos/hero.jpg', 'elements.0.src'],
      ['assets/icons/cart.svg', 'elements.1.icon'],
      ['assets/icons/spinner.svg', 'states.Loading.0.set.icon'],
    ],
  );
  const { assets, missing, unused } = assetsSummary(project);
  assert.deepEqual(assets.find((a) => a.path === 'assets/icons/cart.svg').usedBy.map((r) => r.screen), ['assets-demo']);
  assert.deepEqual(missing.map((r) => r.path), ['assets/icons/spinner.svg']);
  assert.deepEqual(unused, ['assets/icons/unused.svg']);
});

test('L25 warns once per reference that names no file, at its YAML path', async () => {
  const dir = await projectWithAssets();
  const project = await loadProject(dir);
  const l25 = lint(project, { branch: null }).filter((f) => f.id === 'L25');
  assert.equal(l25.length, 1);
  assert.equal(l25[0].severity, 'warning');
  assert.deepEqual(l25[0].path, ['states', 'Loading', 0, 'set', 'icon']);
  assert.match(l25[0].file, /assets-demo\.yaml$/);
  assert.match(l25[0].message, /"assets\/icons\/spinner\.svg" names no file/);
});

test('the bundled set draws an asset as the picture itself: an image from its src, an icon as a small img, while a glyph stays text', async () => {
  const dir = await projectWithAssets();
  const project = await loadProject(dir);
  const screen = project.screens.find((s) => s.doc.screen === 'assets-demo');
  const html = renderScreen(project, screen, { branch: 'x' });
  assert.match(html, /<div class="img size-md"><img src="assets\/photos\/hero\.jpg" alt="The shop"><\/div>/);
  assert.match(html, /<span class="ico"><img class="ico-img" src="assets\/icons\/cart\.svg" alt=""><\/span>/);
  assert.match(html, /<span class="ico">★<\/span>/);
  // the Loading state names a file that is not there: the tag still points at it, lint says so
  assert.match(html, /src="assets\/icons\/spinner\.svg"/);
});

test('the assets page is a card per file under its folder, with who uses it, then the references to no file and the files nothing names', async () => {
  const dir = await projectWithAssets();
  const project = await loadProject(dir);
  const html = renderAssets(project, { branch: 'x' });
  assert.match(html, /<div class="section-title"><code>icons<\/code> <span class="hint">2 files<\/span><\/div>/);
  assert.match(html, /<a class="asset" data-asset="assets\/icons\/cart\.svg" data-panel="[^"]*assets-demo[^"]*" href="#a:assets\/icons\/cart\.svg"><div class="asset-pic"><img src="assets\/icons\/cart\.svg" alt=""><\/div>/);
  assert.match(html, /<span class="pill ok">1 uses<\/span>/);
  assert.match(html, /<span class="pill tbd">unused<\/span>/);
  assert.match(html, /References to no file<\/div><ul class="list"><li><code class="bad">assets\/icons\/spinner\.svg<\/code> — <a href="canvas-inventory\.html#assets-demo"><u>assets-demo<\/u><\/a> <span class="hint">states\.Loading\.0\.set\.icon<\/span><\/li>/);
  assert.match(html, /Files nothing names<\/div><ul class="list"><li><a href="#a:assets\/icons\/unused\.svg">/);
  // the same shell as every page, the design system above the tree
  assert.match(html, /<div class="base"><a class="side-link" href="index\.html">.*<div class="tree-sec">Design system<\/div><a class="side-link sub" href="tokens\.html">.*<a class="side-link sub" href="components\.html">.*<a class="side-link sub current" href="assets\.html"><span class="name">Assets<\/span><span class="hint">3<\/span><\/a><\/div>/);
  assert.match(html, /<nav class="views"><a class="" href="canvas-home\.html">Canvas<\/a><a class="" href="proto\.html#[a-z-]+">Prototype<\/a><\/nav>/);
  // and with no assets/ at all, a hint that says where they go
  const bare = renderAssets(await loadProject(ops), { branch: 'x' });
  assert.match(bare, /Put icons and pictures under assets\//);
});

test('doan assets / list_assets give the same summary as the page, with paths relative to the project', async () => {
  const dir = await projectWithAssets();
  const r = await listAssets(dir);
  assert.equal(r.count, 3);
  assert.deepEqual(r.unused, ['assets/icons/unused.svg']);
  assert.deepEqual(r.missing.map((m) => [m.path, m.at, m.file]), [['assets/icons/spinner.svg', 'states.Loading.0.set.icon', 'screens/assets-demo.yaml']]);
  assert.deepEqual(r.assets.find((a) => a.path === 'assets/icons/cart.svg').usedBy.map((u) => [u.screen, u.at]), [['assets-demo', 'elements.1.icon']]);
});
