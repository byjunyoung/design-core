#!/usr/bin/env node
import { relative } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lintProject, renderProject, initProject, componentBases, importFigma, mapFigma, listTokens, migrateKinds, listComponents, listAssets, specScreen, exportTokens } from './verbs.js';
import { startServer } from './serve.js';
import { prepFile } from './prep.js';
import { diffScreens, renderDiffMarkdown, readScreenAt } from './diff.js';
import { propose, applyProposal, rejectProposal, undoProposal, listProposals } from './proposals.js';
import { readFileSync, writeFileSync } from 'node:fs';

const USAGE = `doan — screens as files; the agent draws, you say what to change.

usage: doan <verb> …

  init <project-dir> [--base none|antd]
        start a project: conventions, sections, tokens, screens/. --base none (default) copies the
        component set into <project-dir>/components so it is yours; a library base maps kinds to it.
  bases  list the component bases and whether each is ready
  components <project-dir> [--json]
        every kind in the registry (components/<kind>.yaml) — props, slots, token bindings, compound or not.
  spec <project-dir> <screen> [--md | --format json|md] [--out <file>]
        the developer spec of one screen: elements with code mappings, copy, states, flows, tokens, assets,
        open questions and acceptance criteria — JSON for an agent, Markdown for a ticket.
  tokens <project-dir> [--json | --format css|tailwind [--out <file>]]
        every token the project resolves — name, value, per-theme values, file, tier (primitive · semantic · bundled).
        tokens/ holds DTCG 2025.10 files and a resolver; a flat tokens.json from before 0.3 still reads.
  assets <project-dir> [--json]
        every file under assets/ with who names it, the references that name no file, the files nothing names.

  lint <project-dir> [--branch <name>] [--today YYYY-MM-DD] [--json]
        validate every screen file against the schema and run rules L01–L15.
        --branch defaults to the current git branch; pass it explicitly in CI.
        exit 0: no blocking findings · 1: blocking findings · 2: usage or load error
  prep <screen-file> [--target <element-id>] [--owner <name>] [--project <dir>]
        stub every state the screen's type requires and the file lacks, as $tbd placeholders.
        the file is rewritten in place; comments and order are kept.
  diff <a.yaml> <b.yaml> [--json]        or        diff <screen-file> --from <git-ref> [--to <git-ref>] [--json]
        AS-IS / TO-BE between two versions of a screen. elements are compared by id.
  render <project-dir> [--out <dir>] [--components antd] [--branch <name>] [--today YYYY-MM-DD] [--proposal <id>]
        draw every screen with the bundled component set: out/index.html + one page per screen,
        every state side by side, variants in their own rows, an inspector on click. file:// safe.
        pending proposals get a page each (AS-IS beside TO-BE); --proposal draws one of any status.
        --components draws mapped kinds with that library (maps_to in conventions); unmapped kinds keep the bundled set.
  import figma <project-dir> <file-key> --page "<page name>" [--force]
        one screen file per {screen}-{state} frame group on that page; other states become patches;
        kinds by maps_to.figma on the master name, then by node name; unresolved → $tbd. Needs FIGMA_TOKEN.
  migrate kinds <project-dir>
        move every row of conventions.kinds into components/<kind>.yaml — the bundled contract where one
        exists, the row's anchors and maps_to laid over it — and drop the block. A project from before 0.4.
  map figma <project-dir> <file-key> --page "<page name>" [--write]
        pair the page's component masters with kinds by name and (with --write) put them into
        conventions.yaml as maps_to.figma. Run this before import figma; it is what makes kinds resolve.
  serve <project-dir> [--port 4870] [--components antd] [--branch <name>]
        the viewer, live: pages rendered from the files on every request, comments on elements,
        Apply / Reject on a proposal page, /api/lint for a bot. The seed of the hosted service.
  mcp <project-dir> [--branch <name>] [--today YYYY-MM-DD]
        start the MCP server on stdio: the same verbs for an agent, plus get_screen and list_missing.
  propose <project-dir> <screen> --with <new.yaml> [--summary "…"] [--decisions <file.json>] [--comments <id,id>] [--json]
        queue a new version of a screen (or a new screen): diff, lint before/after, tier. text-only + clean lint applies at once.
        --comments names the open comments it answers; apply resolves them, undo reopens them.
  proposals <project-dir> [--status pending|applied|all]
  apply <project-dir> <id> --by <name>      reject <project-dir> <id> [--reason "…"]      undo <project-dir> <id>`;

function parseArgs(argv) {
  const [verb, ...rest] = argv;
  const opts = { _: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--json' || a === '--force' || a === '--write') opts[a.slice(2)] = true;
    else if (a.startsWith('--') && rest[i + 1] !== undefined) opts[a.slice(2)] = rest[++i];
    else opts._.push(a);
  }
  return { verb, opts };
}

async function lintCommand(opts) {
  const dir = opts._[0];
  if (!dir) throw Object.assign(new Error(USAGE), { exit: 2 });
  const { summary, findings } = await lintProject(dir, { branch: opts.branch, today: opts.today });
  if (opts.json) {
    process.stdout.write(JSON.stringify({ summary, findings }, null, 2) + '\n');
  } else {
    for (const f of findings) {
      const where = `${f.file}${f.line ? `:${f.line}` : ''}`;
      const path = Array.isArray(f.path) ? f.path.join('.') : f.path;
      process.stdout.write(`${f.severity === 'blocking' ? 'BLOCK' : 'warn '}  ${f.id}  ${where}  ${path}  ${f.message}\n`);
    }
    process.stdout.write(`${summary.screens} screens on ${summary.branch ?? '(no branch)'} — ${summary.blocking} blocking, ${summary.warning} warning\n`);
  }
  return summary.blocking ? 1 : 0;
}

async function prepCommand(opts) {
  const file = opts._[0];
  if (!file) throw Object.assign(new Error(USAGE), { exit: 2 });
  const result = await prepFile(file, { projectDir: opts.project, target: opts.target, owner: opts.owner });
  if (opts.json) process.stdout.write(JSON.stringify(result) + '\n');
  else if (result.added.length) process.stdout.write(`${relative(process.cwd(), file)}: added ${result.added.join(', ')} as placeholders on "${result.target}"\n`);
  else process.stdout.write(`${relative(process.cwd(), file)}: nothing missing\n`);
  return 0;
}

async function diffCommand(opts) {
  const [a, b] = opts._;
  if (!a || (!b && !opts.from)) throw Object.assign(new Error(USAGE), { exit: 2 });
  const before = b ? readScreenAt(a) : readScreenAt(a, opts.from);
  const after = b ? readScreenAt(b) : readScreenAt(a, opts.to);
  const diff = diffScreens(before, after);
  if (opts.json) process.stdout.write(JSON.stringify(diff, null, 2) + '\n');
  else process.stdout.write(renderDiffMarkdown(diff, { screen: after.screen ?? before.screen }));
  return 0;
}

async function renderCommand(opts) {
  const dir = opts._[0];
  if (!dir) throw Object.assign(new Error(USAGE), { exit: 2 });
  const { out, pages } = await renderProject(dir, { branch: opts.branch, today: opts.today, out: opts.out, proposal: opts.proposal, components: opts.components });
  process.stdout.write(`${pages.length} pages → ${relative(process.cwd(), out) || out}/\n`);
  return 0;
}

function mcpCommand(opts) {
  const dir = opts._[0];
  if (!dir) throw Object.assign(new Error(USAGE), { exit: 2 });
  const server = fileURLToPath(new URL('./mcp.js', import.meta.url));
  const args = [server, dir];
  for (const k of ['branch', 'today']) if (opts[k]) args.push(`--${k}`, opts[k]);
  return new Promise((res) => spawn(process.execPath, args, { stdio: 'inherit' }).on('exit', (code) => res(code ?? 0)));
}

async function proposeCommand(opts) {
  const [dir, screen] = opts._;
  if (!dir || !screen || !opts.with) throw Object.assign(new Error(USAGE), { exit: 2 });
  const decisions = opts.decisions ? JSON.parse(readFileSync(opts.decisions, 'utf8')) : [];
  const comments = opts.comments ? String(opts.comments).split(',').map((x) => x.trim()).filter(Boolean) : [];
  const p = await propose(dir, { screen, after: readFileSync(opts.with, 'utf8'), summary: opts.summary ?? '', decisions, comments }, { branch: opts.branch, today: opts.today });
  if (opts.json) process.stdout.write(JSON.stringify(p, null, 2) + '\n');
  else process.stdout.write(`${p.id}  ${p.status}  tier=${p.tier}  lint ${p.lint.before.blocking}→${p.lint.after.blocking} blocking\n${p.markdown}`);
  return 0;
}
async function proposalsCommand(opts) {
  const [dir] = opts._;
  if (!dir) throw Object.assign(new Error(USAGE), { exit: 2 });
  const list = await listProposals(dir, { status: opts.status ?? 'pending' });
  for (const p of list) process.stdout.write(`${p.id}  ${p.status}  ${p.screen}  tier=${p.tier}  ${p.summary}\n`);
  if (!list.length) process.stdout.write('no proposals\n');
  return 0;
}
const gated = (fn, key) => async (opts) => {
  const [dir, id] = opts._;
  if (!dir || !id) throw Object.assign(new Error(USAGE), { exit: 2 });
  const p = await fn(dir, { id, approved_by: opts.by, reason: opts.reason });
  process.stdout.write(`${p.id}  ${p.status}  ${p.screen}\n`);
  return 0;
};

async function initCommand(opts) {
  const [dir] = opts._;
  if (!dir) throw Object.assign(new Error(USAGE), { exit: 2 });
  const r = await initProject(dir, { base: opts.base ?? 'none' });
  process.stdout.write(`${r.dir}: base=${r.base} — created ${r.created.join(', ')}\n\nnext:\n  npx doan serve ${dir}     # open http://127.0.0.1:4870/\n  npx doan lint ${dir}\n  add the MCP server to your agent — see README\n`);
  return 0;
}
async function componentsCommand(opts) {
  const [dir] = opts._;
  if (!dir) throw Object.assign(new Error(USAGE), { exit: 2 });
  const r = await listComponents(dir);
  if (opts.json) return (process.stdout.write(JSON.stringify(r, null, 2) + '\n'), 0);
  process.stdout.write(`${r.count} components${r.legacy.length ? ` (${r.legacy.length} still in conventions.kinds — doan migrate kinds)` : ''}\n`);
  for (const c of r.components) process.stdout.write(`${c.kind.padEnd(18)} ${Object.keys(c.props).join(', ').padEnd(52)} ${c.compound ? 'compound ' : ''}${c.legacy ? 'legacy ' : ''}${c.file ?? ''}\n`);
  return 0;
}
async function specCommand(opts) {
  const [dir, screen] = opts._;
  if (!dir || !screen) throw Object.assign(new Error(USAGE), { exit: 2 });
  const format = opts.md ? 'md' : opts.format ?? 'json';
  const r = await specScreen(dir, { screen, format, branch: opts.branch ?? null });
  const text = typeof r === 'string' ? r : JSON.stringify(r, null, 2) + '\n';
  if (opts.out) {
    writeFileSync(opts.out, text);
    process.stdout.write(`${opts.out}\n`);
  } else process.stdout.write(text);
  return 0;
}
async function tokensCommand(opts) {
  const [dir] = opts._;
  if (!dir) throw Object.assign(new Error(USAGE), { exit: 2 });
  // --format css|tailwind writes the resolved set in a developer's shape instead of listing it
  if (opts.format) {
    const text = await exportTokens(dir, { format: opts.format });
    if (opts.out) {
      writeFileSync(opts.out, text);
      process.stdout.write(`${opts.out}\n`);
    } else process.stdout.write(text);
    return 0;
  }
  const r = await listTokens(dir);
  if (opts.json) return (process.stdout.write(JSON.stringify(r, null, 2) + '\n'), 0);
  process.stdout.write(`${r.tokens.length} tokens from ${r.source}${r.resolver ? ` (${r.resolver})` : ''}${Object.keys(r.axes).length ? ` — ${Object.entries(r.axes).map(([a, c]) => `${a}: ${c.join(' | ')}`).join(', ')}` : ''}\n`);
  for (const t of r.tokens) {
    const per = t.values ? '  ' + Object.entries(t.values).map(([k, v]) => `${k}=${v}`).join(' ') : '';
    process.stdout.write(`${t.name.padEnd(26)} ${String(t.value).padEnd(40)} ${t.tier.padEnd(9)} ${t.file ?? ''}${per}\n`);
  }
  for (const p of r.problems) process.stdout.write(`${p.severity === 'blocking' ? 'BLOCK' : 'warn '}  ${p.file ?? ''}  ${p.path}  ${p.message}\n`);
  return r.problems.some((p) => p.severity === 'blocking') ? 1 : 0;
}
async function assetsCommand(opts) {
  const [dir] = opts._;
  if (!dir) throw Object.assign(new Error(USAGE), { exit: 2 });
  const r = await listAssets(dir);
  if (opts.json) return (process.stdout.write(JSON.stringify(r, null, 2) + '\n'), 0);
  process.stdout.write(`${r.count} assets${r.unused.length ? ` (${r.unused.length} unused)` : ''}${r.missing.length ? ` — ${r.missing.length} references name no file` : ''}\n`);
  for (const a of r.assets) process.stdout.write(`${a.path.padEnd(40)} ${String(a.bytes).padStart(8)} B  ${a.usedBy.map((u) => u.screen ?? `<${u.component}>`).join(', ')}\n`);
  for (const m of r.missing) process.stdout.write(`warn   ${m.file ?? ''}  ${m.at}  "${m.path}" names no file\n`);
  return 0;
}
function basesCommand() {
  for (const b of componentBases()) process.stdout.write(`${b.id.padEnd(8)} ${b.status.padEnd(8)} ${b.label} — ${b.note}\n`);
  return 0;
}

async function importCommand(opts) {
  const [source, dir, fileKey] = opts._;
  if (source !== 'figma' || !dir || !fileKey || !opts.page) throw Object.assign(new Error(USAGE), { exit: 2 });
  const r = await importFigma(dir, { fileKey, page: opts.page, force: opts.force === 'true' || opts.force === true });
  process.stdout.write(`page "${r.page}": ${r.screens.length} screen(s) → ${r.files.map((f) => relative(process.cwd(), f)).join(', ')}\n${r.tbd} $tbd left for a person; run lint to see them\n`);
  return 0;
}

async function migrateCommand(opts) {
  const [what, dir] = opts._;
  if (what !== 'kinds' || !dir) throw Object.assign(new Error(USAGE), { exit: 2 });
  const r = await migrateKinds(dir);
  if (opts.json) return (process.stdout.write(JSON.stringify(r, null, 2) + '\n'), 0);
  process.stdout.write(`${r.removed} kind(s) left conventions.kinds → components/: ${r.written.length} from the bundled contracts, ${r.updated.length} merged into files already there, ${r.minimal.length} minimal (${r.minimal.join(', ') || 'none'})\n`);
  return 0;
}

async function mapCommand(opts) {
  const [source, dir, fileKey] = opts._;
  if (source !== 'figma' || !dir || !fileKey || !opts.page) throw Object.assign(new Error(USAGE), { exit: 2 });
  const r = await mapFigma(dir, { fileKey, page: opts.page, write: opts.write === true });
  if (opts.json) return (process.stdout.write(JSON.stringify(r, null, 2) + '\n'), 0);
  process.stdout.write(`page "${r.page}": ${r.masters} masters\n`);
  for (const [kind, master] of Object.entries(r.mapped)) process.stdout.write(`  ${kind.padEnd(14)} ← ${master}\n`);
  for (const [kind, master] of Object.entries(r.already)) process.stdout.write(`  ${kind.padEnd(14)} = ${master}  (already set)\n`);
  if (r.unmatched.length) process.stdout.write(`  unplaced: ${r.unmatched.join(', ')}\n`);
  process.stdout.write(opts.write === true ? `wrote ${r.written.length} into conventions.yaml\n` : `dry run — add --write to put ${Object.keys(r.mapped).length} into conventions.yaml\n`);
  return 0;
}

async function serveCommand(opts) {
  const [dir] = opts._;
  if (!dir) throw Object.assign(new Error(USAGE), { exit: 2 });
  const s = await startServer(dir, { port: Number(opts.port) || 4870, branch: opts.branch, today: opts.today, components: opts.components ?? null });
  process.stdout.write(`viewer at ${s.url}  (ctrl-c to stop)\n`);
  return new Promise(() => {});
}

function helpCommand() {
  process.stdout.write(USAGE + '\n');
  return 0;
}
async function versionCommand() {
  const { readFileSync } = await import('node:fs');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  process.stdout.write(`doan ${pkg.version}\n`);
  return 0;
}

const verbs = {
  help: helpCommand, '--help': helpCommand, '-h': helpCommand, '--version': versionCommand, '-v': versionCommand,
  init: initCommand, bases: basesCommand, tokens: tokensCommand, components: componentsCommand, assets: assetsCommand, spec: specCommand, import: importCommand, map: mapCommand, migrate: migrateCommand, serve: serveCommand,
  lint: lintCommand, prep: prepCommand, diff: diffCommand, render: renderCommand, mcp: mcpCommand,
  propose: proposeCommand, proposals: proposalsCommand, apply: gated(applyProposal), reject: gated(rejectProposal), undo: gated(undoProposal),
};
const { verb, opts } = parseArgs(process.argv.slice(2));
try {
  if (!verb) throw Object.assign(new Error(USAGE), { exit: 2 });
  if (!verbs[verb]) throw Object.assign(new Error(`unknown verb "${verb}"\n\n${USAGE}`), { exit: 2 });
  process.exit(await verbs[verb](opts));
} catch (err) {
  process.stderr.write((err.exit === 2 ? err.message : `error: ${err.message}\n${USAGE}`) + '\n');
  process.exit(err.exit ?? 2);
}
