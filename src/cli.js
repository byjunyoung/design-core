#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';
import { loadProject, validateScreen, validateConventions, lint, summarize } from './index.js';

const USAGE = `usage: design-core lint <project-dir> [--branch <name>] [--today YYYY-MM-DD] [--json]

  lint    validate every screen file against the schema and run rules L01–L14.
          --branch defaults to the current git branch; pass it explicitly in CI.
          exit 0: no blocking findings · 1: blocking findings · 2: usage or load error`;

function parseArgs(argv) {
  const [verb, ...rest] = argv;
  const opts = { _: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--json') opts.json = true;
    else if (a === '--branch' || a === '--today') opts[a.slice(2)] = rest[++i];
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

const { verb, opts } = parseArgs(process.argv.slice(2));
try {
  if (verb !== 'lint') throw Object.assign(new Error(USAGE), { exit: 2 });
  process.exit(await lintCommand(opts));
} catch (err) {
  process.stderr.write((err.exit === 2 ? err.message : `error: ${err.message}\n${USAGE}`) + '\n');
  process.exit(err.exit ?? 2);
}
