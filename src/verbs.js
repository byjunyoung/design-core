import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { loadProject } from './project.js';
import { validateScreen, validateConventions } from './validate.js';
import { lint, summarize } from './lint.js';
import { mergeState } from './merge.js';
import { prepFile } from './prep.js';
import { diffScreens, renderDiffMarkdown, readScreenAt } from './diff.js';
import { renderScreen, renderIndex, renderProposal } from './render/index.js';
import { listProposals } from './proposals.js';
import { addComment, listComments, resolveComment } from './comments.js';
import { resolveAdapter } from './render/adapters/index.js';
import { initProject, componentBases } from './init.js';
import { importFigmaTree, writeImport, fetchFigmaPage } from './import/figma.js';
import { masterNames, suggestFigmaMap, writeFigmaMap } from './import/map.js';

// One implementation per verb, returning plain JSON. The CLI prints it, the MCP server
// returns it, the viewer will read it. Nothing here writes to stdout.

export function currentBranch(dir) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

const today = (t) => t ?? new Date().toISOString().slice(0, 10);

export async function lintProject(dir, opts = {}) {
  const project = await loadProject(dir);
  const branch = opts.branch ?? currentBranch(dir);
  // Schema errors come first and stop the run: a rule cannot read a file the schema rejects.
  const schemaFindings = [];
  for (const e of validateConventions(project.conventions).errors)
    schemaFindings.push({ id: 'SCHEMA', severity: 'blocking', file: join(dir, 'conventions.yaml'), path: e.path, line: null, message: e.message });
  for (const s of project.screens)
    for (const e of validateScreen(s.doc).errors)
      schemaFindings.push({ id: 'SCHEMA', severity: 'blocking', screen: s.doc.screen, file: s.file, path: e.path, line: null, message: e.message });
  const findings = schemaFindings.length ? schemaFindings : lint(project, { branch, today: today(opts.today) });
  const cwd = opts.cwd ?? process.cwd();
  for (const f of findings) f.file = relative(cwd, f.file) || f.file;
  return { summary: { ...summarize(findings), branch, screens: project.screens.length }, findings };
}

export async function listMissing(dir, opts = {}) {
  const { summary, findings } = await lintProject(dir, opts);
  const mine = findings.filter((f) => f.id === 'L03' || f.id === 'L08');
  return { summary: { ...summary, ...summarize(mine) }, findings: mine };
}

export async function listScreens(dir) {
  const project = await loadProject(dir);
  return {
    sections: project.sections,
    screens: project.screens.map((s) => ({
      screen: s.doc.screen,
      id: s.doc.id,
      section: s.doc.section,
      type: s.doc.type,
      file: s.file,
      states: Object.keys(s.doc.states ?? {}),
      variants: Object.fromEntries(Object.entries(s.doc.variants ?? {}).map(([k, v]) => [k, Object.keys(v ?? {})])),
    })),
  };
}

export async function getScreen(dir, { screen, state = 'Default', variants = {} }) {
  const project = await loadProject(dir);
  const found = project.screens.find((s) => s.doc.screen === screen);
  if (!found) throw new Error(`no screen named "${screen}" in ${dir}`);
  const view = mergeState(found.doc, state, variants);
  return { screen, file: found.file, type: found.doc.type, refs: found.doc.refs ?? {}, ...view, flows: found.doc.flows ?? [], notes: found.doc.notes ?? [] };
}

export async function prepScreen(dir, { screen, target, owner }) {
  const project = await loadProject(dir);
  const found = project.screens.find((s) => s.doc.screen === screen);
  if (!found) throw new Error(`no screen named "${screen}" in ${dir}`);
  return prepFile(found.file, { projectDir: dir, target, owner });
}

// `before`/`after` are YAML texts, or a screen name with `from`/`to` git refs.
export async function diffScreen(dir, { screen, before, after, from, to }) {
  let a;
  let b;
  if (before !== undefined && after !== undefined) {
    a = parse(before);
    b = parse(after);
  } else {
    const project = await loadProject(dir);
    const found = project.screens.find((s) => s.doc.screen === screen);
    if (!found) throw new Error(`no screen named "${screen}" in ${dir}`);
    const rel = relative(dir, found.file);
    a = readScreenAt(rel, from ?? 'HEAD', dir);
    b = to ? readScreenAt(rel, to, dir) : found.doc;
  }
  const diff = diffScreens(a, b);
  return { ...diff, markdown: renderDiffMarkdown(diff, { screen: b?.screen ?? a?.screen ?? screen }) };
}

export async function renderProject(dir, opts = {}) {
  const project = await loadProject(dir);
  const branch = opts.branch ?? currentBranch(dir);
  const out = opts.out ?? join(dir, 'out');
  const adapter = await resolveAdapter(project, opts.components ?? null);
  await mkdir(out, { recursive: true });
  const pages = [];
  const pending = await listProposals(dir, { status: 'pending' });
  await writeFile(join(out, 'index.html'), renderIndex(project, { branch, today: today(opts.today), proposals: pending }));
  pages.push(join(out, 'index.html'));
  for (const s of project.screens) {
    const file = join(out, `${s.doc.screen}.html`);
    await writeFile(file, renderScreen(project, s, { branch, adapter }));
    pages.push(file);
  }
  // Every pending proposal gets its page; `proposal` narrows to one (any status).
  const wanted = opts.proposal ? (await listProposals(dir, { status: 'all' })).filter((p) => p.id === opts.proposal) : pending;
  if (opts.proposal && !wanted.length) throw new Error(`no proposal "${opts.proposal}"`);
  for (const meta of wanted) {
    const full = JSON.parse(await readFile(join(dir, '.proposals', `${meta.id}.json`), 'utf8'));
    const file = join(out, `proposal-${meta.id}.html`);
    await writeFile(file, renderProposal(project, full, { branch, adapter }));
    pages.push(file);
  }
  return { out, pages };
}

export { initProject, componentBases };

// import figma: fetch one page over REST, turn it into screen files, write them.
export async function importFigma(dir, { fileKey, page, force = false, tree = null }) {
  const project = await loadProject(dir);
  const file = tree ?? (await fetchFigmaPage(fileKey, page));
  const result = importFigmaTree(file, { page, conventions: project.conventions, tokens: project.tokens ?? {}, fileKey });
  const written = await writeImport(dir, result, { force });
  return { page: result.page, screens: result.screens.map((s) => s.screen), ...written };
}

// map figma: which component masters a page uses, paired with kinds; written only on request.
export async function mapFigma(dir, { fileKey, page, write = false, tree = null }) {
  const project = await loadProject(dir);
  const file = tree ?? (await fetchFigmaPage(fileKey, page));
  const names = masterNames(file);
  const suggestion = suggestFigmaMap(names, project.conventions);
  const result = { page, masters: names.length, ...suggestion, written: [], skipped: [] };
  if (write) Object.assign(result, await writeFigmaMap(dir, suggestion.mapped));
  return result;
}

export { addComment, listComments, resolveComment };
