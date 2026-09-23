#!/usr/bin/env node
import { relative } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lintProject, renderProject } from './verbs.js';
import { prepFile } from './prep.js';
import { diffScreens, renderDiffMarkdown, readScreenAt } from './diff.js';

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
        every state side by side, variants in their own rows, an inspector on click. file:// safe.
  mcp <project-dir> [--branch <name>] [--today YYYY-MM-DD]
        start the MCP server on stdio: the same verbs for an agent, plus get_screen and list_missing.`;

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
  const { out, pages } = await renderProject(dir, { branch: opts.branch, today: opts.today, out: opts.out });
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

const verbs = { lint: lintCommand, prep: prepCommand, diff: diffCommand, render: renderCommand, mcp: mcpCommand };
const { verb, opts } = parseArgs(process.argv.slice(2));
try {
  if (!verbs[verb]) throw Object.assign(new Error(USAGE), { exit: 2 });
  process.exit(await verbs[verb](opts));
} catch (err) {
  process.stderr.write((err.exit === 2 ? err.message : `error: ${err.message}\n${USAGE}`) + '\n');
  process.exit(err.exit ?? 2);
}
