import { readFile, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { parseDocument, LineCounter, isNode } from 'yaml';

// A screen file, parsed twice over: `doc` is the plain object every verb works on,
// `lineOf(path)` maps a YAML path back to a 1-based line so findings can point at it.
function parseWithLines(text, file) {
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
  return parseWithLines(await readFile(path, 'utf8'), path).doc;
}

export async function loadScreen(path) {
  return parseWithLines(await readFile(path, 'utf8'), path);
}

export async function loadProject(dir) {
  const conventions = await readYaml(join(dir, 'conventions.yaml'));
  const sections = await readYaml(join(dir, 'sections.yaml'));
  const screensDir = join(dir, 'screens');
  const names = (await readdir(screensDir)).filter((n) => /\.ya?ml$/.test(n)).sort();
  const screens = await Promise.all(names.map((n) => loadScreen(join(screensDir, n))));
  return { dir, conventions, sections, screens, screenName: (s) => basename(s.file) };
}
