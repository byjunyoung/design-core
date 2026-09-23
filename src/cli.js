#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';
import { loadProject, validateScreen, validateConventions, lint, summarize } from './index.js';
import { prepFile } from './prep.js';
import { diffScreens, renderDiffMarkdown, readScreenAt } from './diff.js';
import { renderScreen, renderIndex } from './render/index.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const USAGE = `usage: design-core <verb> …

  lint <project-dir> [--branch <name>] [--today YYYY-MM-DD] [--json]
        validate every screen file against the schema and run rules L01–L15.
        --branch defaults to the current git branch; pass it explicitly in CI.
        exit 0: no blocking findings · 1: blocking findings · 2: usage or load error
  prep <screen-file> [--target <element-id>] [--owner <name>] [--project <dir>]
        stub every state the screen's type requires and the file lacks, as $tbd placeholders.
        the file is rewritten in place; comments and order are kept.
  diff <a.yaml> <b.yaml> [--json]        or        diff <screen-file> --from <git-ref> [--to <git-ref>] [--json]
        AS-IS / TO-BE between two versions of a screen. elements are compared by id.
  render <project-dir> [--out <dir>] [--branch <name>] [--today YYYY-MM-DD]
        draw every screen with the bundled component set: out/index.html + one page per screen,
        every state side by side, variants in their own rows, an inspector on click. file:// safe.`;

function parseArgs(argv) {
  const [verb, ...rest] = argv;
  const opts = { _: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--json') opts.json = true;
    else if (a.startsWith('--') && rest[i + 1] !== undefined) opts[a.slice(2)] = rest[++i];
    else opts._.push(a);
  }
  return { verb, opts };
}

function currentBranch(dir) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

async function lintCommand(opts) {
  const dir = opts._[0];
  if (!dir) throw Object.assign(new Error(USAGE), { exit: 2 });
  const project = await loadProject(dir);
  const branch = opts.branch ?? currentBranch(dir);
  const today = opts.today ?? new Date().toISOString().slice(0, 10);

  // Schema errors come first and stop the run: a rule cannot read a file the schema rejects.
  const schemaFindings = [];
  const conv = validateConventions(project.conventions);
  for (const e of conv.errors) schemaFindings.push({ id: 'SCHEMA', severity: 'blocking', file: 'conventions.yaml', path: e.path, line: null, message: e.message });
  for (const s of project.screens) {
    const r = validateScreen(s.doc);
    for (const e of r.errors) schemaFindings.push({ id: 'SCHEMA', severity: 'blocking', screen: s.doc.screen, file: s.file, path: e.path, line: null, message: e.message });
  }
  const findings = schemaFindings.length ? schemaFindings : lint(project, { branch, today });
  for (const f of findings) f.file = relative(process.cwd(), f.file) || f.file;
  const summary = { ...summarize(findings), branch, screens: project.screens.length };

  if (opts.json) {
    process.stdout.write(JSON.stringify({ summary, findings }, null, 2) + '\n');
  } else {
    for (const f of findings) {
      const where = `${f.file}${f.line ? `:${f.line}` : ''}`;
      const path = Array.isArray(f.path) ? f.path.join('.') : f.path;
      process.stdout.write(`${f.severity === 'blocking' ? 'BLOCK' : 'warn '}  ${f.id}  ${where}  ${path}  ${f.message}\n`);
    }
    process.stdout.write(`${summary.screens} screens on ${branch ?? '(no branch)'} — ${summary.blocking} blocking, ${summary.warning} warning\n`);
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
  const project = await loadProject(dir);
  const branch = opts.branch ?? currentBranch(dir);
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const out = opts.out ?? join(dir, 'out');
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'index.html'), renderIndex(project, { branch, today }));
  for (const s of project.screens) await writeFile(join(out, `${s.doc.screen}.html`), renderScreen(project, s, { branch }));
  process.stdout.write(`${project.screens.length + 1} pages → ${relative(process.cwd(), out) || out}/\n`);
  return 0;
}

const verbs = { lint: lintCommand, prep: prepCommand, diff: diffCommand, render: renderCommand };
const { verb, opts } = parseArgs(process.argv.slice(2));
try {
  if (!verbs[verb]) throw Object.assign(new Error(USAGE), { exit: 2 });
  process.exit(await verbs[verb](opts));
} catch (err) {
  process.stderr.write((err.exit === 2 ? err.message : `error: ${err.message}\n${USAGE}`) + '\n');
  process.exit(err.exit ?? 2);
}
