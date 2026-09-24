import { readFile, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { parseDocument, LineCounter, isNode } from 'yaml';
import { loadTokens } from './tokens.js';
import { loadComponents } from './components.js';
import { loadAssets } from './assets.js';

// A screen file, parsed twice over: `doc` is the plain object every verb works on,
// `lineOf(path)` maps a YAML path back to a 1-based line so findings can point at it.
export function parseScreenText(text, file) {
  const lineCounter = new LineCounter();
  const document = parseDocument(text, { lineCounter, keepSourceTokens: true });
  const doc = document.toJS();
  const lineOf = (path) => {
    const node = document.getIn(path, true);
    if (!isNode(node) || !node.range) return null;
    return lineCounter.linePos(node.range[0]).line;
  };
  return { file, doc, lineOf, errors: document.errors.map((e) => e.message) };
}

async function readYaml(path) {
  return parseScreenText(await readFile(path, 'utf8'), path).doc;
}

export async function loadScreen(path) {
  return parseScreenText(await readFile(path, 'utf8'), path);
}

export async function loadProject(dir) {
  const conventions = await readYaml(join(dir, 'conventions.yaml'));
  const sections = await readYaml(join(dir, 'sections.yaml'));
  const screensDir = join(dir, 'screens');
  const names = (await readdir(screensDir)).filter((n) => /\.ya?ml$/.test(n)).sort();
  const screens = await Promise.all(names.map((n) => loadScreen(join(screensDir, n))));
  // tokens.json, tokens/*.tokens.json or a resolver — see src/tokens.js. `tokens` is the
  // resolved default context in the shape render and the adapters always read; `tokenSet`
  // carries every context, the source and any problems for lint. Missing is fine: render
  // falls back to the bundled set.
  const tokenSet = await loadTokens(dir);
  // components/*.yaml plus whatever conventions.kinds still holds — see src/components.js.
  const componentSet = await loadComponents(dir, conventions);
  // assets/**: the person's icons and pictures, which screens name by path — see src/assets.js
  const assets = await loadAssets(dir);
  return { dir, conventions, sections, screens, tokens: tokenSet.tokens, tokenSet, components: componentSet.registry, componentSet, assets, screenName: (s) => basename(s.file) };
}
