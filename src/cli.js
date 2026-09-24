#!/usr/bin/env node
import { relative } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lintProject, renderProject, initProject, componentBases, importFigma, mapFigma } from './verbs.js';
import { startServer } from './serve.js';
import { prepFile } from './prep.js';
import { diffScreens, renderDiffMarkdown, readScreenAt } from './diff.js';
import { propose, applyProposal, rejectProposal, undoProposal, listProposals } from './proposals.js';
import { readFileSync } from 'node:fs';

const USAGE = `design-core — screens as files; the agent draws, you say what to change.

usage: design-core <verb> …

  init <project-dir> [--base none|antd]
        start a project: conventions, sections, tokens, screens/. --base none (default) copies the
        component set into <project-dir>/components so it is yours; a library base maps kinds to it.
  bases  list the component bases and whether each is ready

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
  map figma <project-dir> <file-key> --page "<page name>" [--write]
        pair the page's component masters with kinds by name and (with --write) put them into
        conventions.yaml as maps_to.figma. Run this before import figma; it is what makes kinds resolve.
  serve <project-dir> [--port 4870] [--components antd] [--branch <name>]
        the viewer, live: pages rendered from the files on every request, comments on elements,
        Apply / Reject on a proposal page, /api/lint for a bot. The seed of the hosted service.
  mcp <project-dir> [--branch <name>] [--today YYYY-MM-DD]
        start the MCP server on stdio: the same verbs for an agent, plus get_screen and list_missing.
  propose <project-dir> <screen> --with <new.yaml> [--summary "…"] [--decisions <file.json>] [--json]
        queue a new version of a screen: diff, lint before/after, tier. text-only + clean lint applies at once.
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
  const p = await propose(dir, { screen, after: readFileSync(opts.with, 'utf8'), summary: opts.summary ?? '', decisions }, { branch: opts.branch, today: opts.today });
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
  process.stdout.write(`${r.dir}: base=${r.base} — created ${r.created.join(', ')}\n`);
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
  process.stdout.write(`design-core ${pkg.version}\n`);
  return 0;
}

const verbs = {
  help: helpCommand, '--help': helpCommand, '-h': helpCommand, '--version': versionCommand, '-v': versionCommand,
  init: initCommand, bases: basesCommand, import: importCommand, map: mapCommand, serve: serveCommand,
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
