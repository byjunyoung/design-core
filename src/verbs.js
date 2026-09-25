import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, cp } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';
import { parse, parseDocument } from 'yaml';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadProject } from './project.js';
import { tokenNames, getToken } from './tokens.js';
import { DEFAULT_TOKENS, mergeTokens } from './render/tokens.js';
import { validateScreen, validateConventions, validateComponent } from './validate.js';
import { lint, summarize } from './lint.js';
import { mergeState } from './merge.js';
import { prepFile } from './prep.js';
import { diffScreens, renderDiffMarkdown, readScreenAt } from './diff.js';
import { renderScreen, renderIndex, renderProposal, renderLibrary, renderProto, renderCanvas, renderTokens, renderAssets } from './render/index.js';
import { canvasPages } from './canvas.js';
import { assetsSummary } from './assets.js';
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
  for (const c of Object.values(project.components ?? {})) {
    if (!c.file) continue;
    const { file, legacy, ...doc } = c;
    for (const e of validateComponent(doc).errors) schemaFindings.push({ id: 'SCHEMA', severity: 'blocking', file, path: e.path, line: null, message: e.message });
  }
  for (const p of project.componentSet?.problems ?? []) schemaFindings.push({ id: 'SCHEMA', severity: 'blocking', file: p.file, path: p.path, line: null, message: p.message });
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
      breakpoints: Object.keys(s.doc.breakpoints ?? {}),
      file: s.file,
      states: Object.keys(s.doc.states ?? {}),
      variants: Object.fromEntries(Object.entries(s.doc.variants ?? {}).map(([k, v]) => [k, Object.keys(v ?? {})])),
    })),
  };
}

export async function getScreen(dir, { screen, state = 'Default', variants = {}, breakpoint = null }) {
  const project = await loadProject(dir);
  const found = project.screens.find((s) => s.doc.screen === screen);
  if (!found) throw new Error(`no screen named "${screen}" in ${dir}`);
  const view = mergeState(found.doc, state, variants, breakpoint);
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
  await writeFile(join(out, 'index.html'), await renderIndex(project, { branch, today: today(opts.today), proposals: pending, adapter }));
  pages.push(join(out, 'index.html'));
  await writeFile(join(out, 'components.html'), renderLibrary(project, { branch, adapter }));
  pages.push(join(out, 'components.html'));
  await writeFile(join(out, 'tokens.html'), renderTokens(project, { branch }));
  pages.push(join(out, 'tokens.html'));
  await writeFile(join(out, 'assets.html'), renderAssets(project, { branch }));
  pages.push(join(out, 'assets.html'));
  await writeFile(join(out, 'proto.html'), renderProto(project, { branch, adapter }));
  pages.push(join(out, 'proto.html'));
  // the person's asset files go along, at the relative path the pages name them by
  await cp(join(dir, 'assets'), join(out, 'assets'), { recursive: true }).catch(() => {});
  for (const spec of canvasPages(project)) {
    const file = join(out, `canvas-${spec.slug}.html`);
    await writeFile(file, renderCanvas(project, spec, { branch, adapter }));
    pages.push(file);
  }
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
  const result = importFigmaTree(file, { page, conventions: project.conventions, components: project.components, tokens: project.tokens ?? {}, fileKey });
  const written = await writeImport(dir, result, { force });
  return { page: result.page, screens: result.screens.map((s) => s.screen), ...written };
}

// map figma: which component masters a page uses, paired with kinds; written only on request.
export async function mapFigma(dir, { fileKey, page, write = false, tree = null }) {
  const project = await loadProject(dir);
  const file = tree ?? (await fetchFigmaPage(fileKey, page));
  const names = masterNames(file);
  const suggestion = suggestFigmaMap(names, project.components);
  const result = { page, masters: names.length, ...suggestion, written: [], skipped: [] };
  if (write) Object.assign(result, await writeFigmaMap(dir, suggestion.mapped));
  return result;
}

export { addComment, listComments, resolveComment };

// Every token the project resolves, with what an agent needs before naming one: the value in
// the default context, the value per theme, the file it comes from and its tier. Tier is by
// file — conventions.tokens.primitive lists the stems that hold primitives; anything from
// another file is semantic; a value only the bundled default set provides is 'bundled', and
// a flat tokens.json from before 0.3 has no tiers ('flat').
export async function listTokens(dir) {
  const project = await loadProject(dir);
  const set = project.tokenSet;
  const stems = project.conventions.tokens?.primitive ?? [];
  const stem = (f) => (f ? basename(f).replace(/\.tokens\.json$/, '') : null);
  const merged = mergeTokens(DEFAULT_TOKENS, set.tokens ?? {});
  const axes = Object.fromEntries(Object.entries(set.contexts ?? {}).map(([a, c]) => [a, Object.keys(c)]));
  const tokens = tokenNames(merged).map((name) => {
    const file = set.origins?.[name] ?? null;
    const values = {};
    for (const [axis, byCtx] of Object.entries(set.contexts ?? {}))
      for (const [ctx, t] of Object.entries(byCtx)) {
        const v = getToken(t, name);
        if (v !== undefined) values[`${axis}=${ctx}`] = v;
      }
    const tier = file ? (stems.includes(stem(file)) ? 'primitive' : 'semantic') : set.source === 'flat' && getToken(set.tokens, name) !== undefined ? 'flat' : 'bundled';
    return { name, value: getToken(merged, name), tier, file: file ? relative(dir, file) : null, ...(Object.keys(values).length ? { values } : {}) };
  });
  return { source: set.source, resolver: set.resolver, defaults: set.defaults, axes, tokens, problems: set.problems.map((p) => ({ ...p, file: p.file ? relative(dir, p.file) : null })) };
}

// migrate kinds: every row of conventions.kinds becomes components/<kind>.yaml — the bundled
// contract where one exists, with the row's own anchors and maps_to laid over it; a minimal
// contract where none does — and the block leaves conventions.yaml. One command, so a project
// from before 0.4 lands on the file-per-kind registry without hand work.
export async function migrateKinds(dir) {
  const file = join(dir, 'conventions.yaml');
  const doc = parseDocument(await readFile(file, 'utf8'));
  const rows = doc.get('kinds')?.toJSON?.() ?? {};
  const bundled = fileURLToPath(new URL('./contracts/', import.meta.url));
  await mkdir(join(dir, 'components'), { recursive: true });
  const written = [];
  const updated = [];
  const minimal = [];
  for (const [kind, row] of Object.entries(rows)) {
    const target = join(dir, 'components', `${kind}.yaml`);
    let cdoc;
    let bucket;
    if (existsSync(target)) {
      cdoc = parseDocument(await readFile(target, 'utf8'));
      bucket = updated;
    } else if (existsSync(join(bundled, `${kind}.yaml`))) {
      cdoc = parseDocument(await readFile(join(bundled, `${kind}.yaml`), 'utf8'));
      bucket = written;
    } else {
      cdoc = parseDocument(`kind: ${kind}\ndescription: (moved from conventions.kinds — describe it)\n`);
      bucket = minimal;
    }
    if (Array.isArray(row?.anchors) && !cdoc.has('anchors')) cdoc.set('anchors', row.anchors);
    for (const [ds, name] of Object.entries(row?.maps_to ?? {})) if (!cdoc.hasIn(['maps_to', ds])) cdoc.setIn(['maps_to', ds], name);
    await writeFile(target, cdoc.toString({ lineWidth: 0 }));
    bucket.push(kind);
  }
  if (doc.has('kinds')) {
    doc.delete('kinds');
    await writeFile(file, doc.toString({ lineWidth: 0 }));
  }
  return { written, updated, minimal, removed: Object.keys(rows).length };
}

// Every contract in the registry, as an agent needs it before drawing: which kinds exist,
// what each declares, what it binds, whether it is a compound part or a row still in
// conventions.kinds. The library page is the same list, drawn.
export async function listComponents(dir) {
  const project = await loadProject(dir);
  const components = Object.values(project.components ?? {})
    .sort((a, b) => a.kind.localeCompare(b.kind))
    .map((c) => ({
      kind: c.kind,
      description: c.description ?? '',
      file: c.file ? relative(dir, c.file) : null,
      legacy: !!c.legacy,
      compound: Array.isArray(c.elements) && c.elements.length > 0,
      anchors: c.anchors ?? [],
      maps_to: c.maps_to ?? {},
      props: c.props ?? {},
      slots: c.slots ?? [],
      tokens: c.tokens ?? {},
      variants: c.variants ?? {},
      sample: c.sample ?? {},
    }));
  return { count: components.length, legacy: project.componentSet?.legacy ?? [], components };
}

// The flows of the whole product as one list — edges that resolve, dead ends, orphans — for an
// agent that wants the structure without the picture. The flow map page draws the same graph.
export async function listFlows(dir) {
  const { flowGraph } = await import('./flowmap.js');
  const project = await loadProject(dir);
  return flowGraph(project);
}

// Every asset file with who names it, the references that name no file, and the files nothing
// names — the assets page draws the same summary (src/assets.js).
export async function listAssets(dir) {
  const project = await loadProject(dir);
  const { assets, missing, unused } = assetsSummary(project);
  const rel = (r) => ({ ...r, file: r.file ? relative(dir, r.file) : null, at: r.at.join('.') });
  return {
    count: assets.length,
    assets: assets.map((a) => ({ path: a.path, bytes: a.bytes, type: a.type, usedBy: a.usedBy.map(rel) })),
    missing: missing.map(rel),
    unused,
  };
}
