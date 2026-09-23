import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join, relative } from 'node:path';
import { loadProject, parseScreenText } from './project.js';
import { validateScreen } from './validate.js';
import { lint, summarize } from './lint.js';
import { diffScreens, renderDiffMarkdown } from './diff.js';

// The edit loop's write half (DESIGN.md §7). An agent proposes a whole new version of one
// screen file. The proposal carries the diff, the lint result before and after, and a tier.
// A text-only change that keeps lint clean applies at once with undo; everything else
// waits for a person to apply or reject it. Proposals live in <project>/.proposals/ so the
// CLI, the MCP server and, later, the viewer see the same queue.

const TEXT_PROPS = new Set(['text', 'label', 'title', 'placeholder', 'caption', 'counter', 'hint', 'note', 'notes', 'when']);
const dirOf = (dir) => join(dir, '.proposals');
const sha = (text) => createHash('sha1').update(text).digest('hex');
const newId = () => `p_${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;

function tierOf(diff) {
  const entries = [...diff.changed, ...diff.added, ...diff.removed];
  if (!entries.length) return 'none';
  const textual = entries.every((e) => {
    const last = e.path[e.path.length - 1];
    return TEXT_PROPS.has(String(last)) || e.path[0] === 'notes';
  });
  return textual ? 'text' : 'structure';
}

async function lintWith(project, screen, text, opts) {
  const replaced = parseScreenText(text, screen.file);
  const screens = project.screens.map((s) => (s.file === screen.file ? replaced : s));
  const findings = lint({ ...project, screens }, opts);
  return { ...summarize(findings), findings: findings.filter((f) => f.file === screen.file) };
}

async function store(dir, proposal) {
  await mkdir(dirOf(dir), { recursive: true });
  await writeFile(join(dirOf(dir), `${proposal.id}.json`), JSON.stringify(proposal, null, 2));
  return proposal;
}

async function load(dir, id) {
  const file = join(dirOf(dir), `${id}.json`);
  if (!existsSync(file)) throw new Error(`no proposal "${id}"`);
  return JSON.parse(await readFile(file, 'utf8'));
}

async function write(dir, proposal, text) {
  await writeFile(join(dir, relative(dir, proposal.file)), text);
}

export async function propose(dir, { screen, after, summary = '' }, opts = {}) {
  const project = await loadProject(dir);
  const found = project.screens.find((s) => s.doc.screen === screen);
  if (!found) throw new Error(`no screen named "${screen}" in ${dir}`);

  const parsed = parseScreenText(after, found.file);
  if (parsed.errors.length) throw new Error(`proposed YAML does not parse: ${parsed.errors[0]}`);
  const schema = validateScreen(parsed.doc);
  if (!schema.ok) throw new Error(`proposed screen fails the schema: ${schema.errors.map((e) => e.message).join('; ')}`);

  const before = await readFile(found.file, 'utf8');
  const diff = diffScreens(found.doc, parsed.doc);
  const tier = tierOf(diff);
  const lintBefore = await lintWith(project, found, before, opts);
  const lintAfter = await lintWith(project, found, after, opts);
  const auto = (project.conventions.edit?.auto_apply ?? []).includes(tier) && lintAfter.blocking === 0;

  const proposal = {
    id: newId(),
    screen,
    file: found.file,
    summary,
    created: new Date().toISOString(),
    tier,
    status: tier === 'none' ? 'empty' : auto ? 'applied' : 'pending',
    auto,
    base_hash: sha(before),
    before,
    after,
    diff,
    markdown: renderDiffMarkdown(diff, { screen }),
    lint: { before: { blocking: lintBefore.blocking, warning: lintBefore.warning }, after: { blocking: lintAfter.blocking, warning: lintAfter.warning, findings: lintAfter.findings } },
  };
  if (tier === 'none') return proposal;
  if (auto) {
    await write(dir, proposal, after);
    proposal.applied_at = proposal.created;
  }
  return store(dir, proposal);
}

export async function applyProposal(dir, { id, approved_by }) {
  if (!approved_by) throw new Error('apply needs approved_by: the person who said yes');
  const p = await load(dir, id);
  if (p.status !== 'pending') throw new Error(`proposal "${id}" is ${p.status}, not pending`);
  const current = await readFile(p.file, 'utf8');
  if (sha(current) !== p.base_hash) throw new Error(`"${p.screen}" changed since the proposal was made; propose again`);
  await write(dir, p, p.after);
  Object.assign(p, { status: 'applied', approved_by, applied_at: new Date().toISOString() });
  return store(dir, p);
}

export async function rejectProposal(dir, { id, reason = '' }) {
  const p = await load(dir, id);
  if (p.status !== 'pending') throw new Error(`proposal "${id}" is ${p.status}, not pending`);
  await unlink(join(dirOf(dir), `${id}.json`));
  return { ...p, status: 'rejected', reason, before: undefined, after: undefined };
}

export async function undoProposal(dir, { id }) {
  const p = await load(dir, id);
  if (p.status !== 'applied') throw new Error(`proposal "${id}" is ${p.status}, not applied`);
  const current = await readFile(p.file, 'utf8');
  if (sha(current) !== sha(p.after)) throw new Error(`"${p.screen}" changed after the proposal was applied; undo by hand`);
  await write(dir, p, p.before);
  Object.assign(p, { status: 'undone', undone_at: new Date().toISOString() });
  return store(dir, p);
}

export async function listProposals(dir, { status = 'pending' } = {}) {
  if (!existsSync(dirOf(dir))) return [];
  const names = (await readdir(dirOf(dir))).filter((n) => n.endsWith('.json'));
  const all = await Promise.all(names.map((n) => load(dir, n.slice(0, -5))));
  return all
    .filter((p) => status === 'all' || p.status === status)
    .sort((a, b) => a.created.localeCompare(b.created))
    .map(({ before, after, ...rest }) => rest);
}
