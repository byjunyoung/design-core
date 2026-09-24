import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join, relative } from 'node:path';
import { loadProject, parseScreenText } from './project.js';
import { validateScreen } from './validate.js';
import { lint, summarize } from './lint.js';
import { diffScreens, renderDiffMarkdown } from './diff.js';
import { listComments, resolveComment, reopenComment } from './comments.js';

// The edit loop's write half (DESIGN.md §7). An agent proposes a whole new version of one
// screen file — or a screen that does not exist yet, which the proposal creates as
// screens/<name>.yaml. The proposal carries the diff, the lint result before and after, and
// a tier. A text-only change that keeps lint clean applies at once with undo; everything
// else, a new screen always, waits for a person to apply or reject it. Proposals live in
// <project>/.proposals/ so the CLI, the MCP server and the viewer see the same queue.
// A proposal names the comments it answers; applying it resolves them, undoing reopens them.

const TEXT_PROPS = new Set(['text', 'label', 'title', 'placeholder', 'caption', 'counter', 'hint', 'note', 'notes', 'when']);
const COMMENT_ID = /\bc_[a-z0-9]{6,}\b/g;
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

// lint the project as it would be with `text` standing in for the screen at `file` — replacing
// the screen when the project has it, added to the project when it does not
async function lintWith(project, file, text, opts) {
  const replaced = parseScreenText(text, file);
  const has = project.screens.some((s) => s.file === file);
  const screens = has ? project.screens.map((s) => (s.file === file ? replaced : s)) : [...project.screens, replaced];
  const findings = lint({ ...project, screens }, opts);
  return { ...summarize(findings), findings: findings.filter((f) => f.file === file) };
}

// the comments a proposal answers: the ids it was given, plus any id mentioned in its summary
// or decisions (the draw prompt writes "why: 코멘트 c_…"). Given ids must be open comments on
// the screen; mentioned ones that are not are simply not counted.
async function answersOf(dir, screen, { comments = [], summary = '', decisions = [] }) {
  const open = new Set((await listComments(dir, { screen, status: 'open' })).map((c) => c.id));
  for (const id of comments) if (!open.has(id)) throw new Error(`no open comment "${id}" on screen "${screen}"`);
  const text = [summary, ...decisions.flatMap((d) => [d.item, d.decision, d.why ?? ''])].join('\n');
  const mentioned = (text.match(COMMENT_ID) ?? []).filter((id) => open.has(id));
  return [...new Set([...comments, ...mentioned])];
}

// resolve the comments a proposal answers, once it is on disk; a comment resolved by hand in
// the meantime is left alone
async function settle(dir, proposal, by) {
  const done = [];
  for (const id of proposal.comments ?? []) {
    try {
      await resolveComment(dir, { id, by, note: `${proposal.id} applied${proposal.summary ? `: ${proposal.summary}` : ''}` });
      done.push(id);
    } catch {
      /* already resolved or gone */
    }
  }
  return done;
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
  await mkdir(join(dir, 'screens'), { recursive: true });
  await writeFile(join(dir, relative(dir, proposal.file)), text);
}

export async function propose(dir, { screen, after, summary = '', decisions = [], comments = [] }, opts = {}) {
  const project = await loadProject(dir);
  const found = project.screens.find((s) => s.doc.screen === screen);
  // a screen the project does not have yet: the proposal creates screens/<name>.yaml, and the
  // name must pass the project's own pattern before anything is parsed
  const creates = !found;
  if (creates) {
    const pattern = project.conventions.naming?.screen_pattern;
    if (pattern && !new RegExp(pattern, 'u').test(screen)) throw new Error(`"${screen}" does not match naming.screen_pattern ${pattern}`);
    if (existsSync(join(dir, 'screens', `${screen}.yaml`))) throw new Error(`screens/${screen}.yaml exists but is not a screen the project loads; fix or remove it first`);
  }
  const file = found ? found.file : join(dir, 'screens', `${screen}.yaml`);

  const parsed = parseScreenText(after, file);
  if (parsed.errors.length) throw new Error(`proposed YAML does not parse: ${parsed.errors[0]}`);
  const schema = validateScreen(parsed.doc);
  if (!schema.ok) throw new Error(`proposed screen fails the schema: ${schema.errors.map((e) => e.message).join('; ')}`);
  // a new file must be the screen it was proposed as; in an existing file a renamed `screen:`
  // is a change like any other, and lint (L01, L05) is what judges it
  if (creates && parsed.doc.screen !== screen) throw new Error(`the proposed YAML names screen "${parsed.doc.screen}", not "${screen}"`);
  const answers = creates ? [] : await answersOf(dir, screen, { comments, summary, decisions });

  const before = found ? await readFile(found.file, 'utf8') : '';
  const diff = diffScreens(found ? found.doc : {}, parsed.doc);
  // a new file is never a text-only change, whatever the diff says
  const tier = creates ? 'structure' : tierOf(diff);
  const lintBefore = creates ? { ...summarize(lint(project, opts)), findings: [] } : await lintWith(project, file, before, opts);
  const lintAfter = await lintWith(project, file, after, opts);
  const auto = !creates && (project.conventions.edit?.auto_apply ?? []).includes(tier) && lintAfter.blocking === 0;

  const proposal = {
    id: newId(),
    screen,
    file,
    creates, // true when applying writes a file the project did not have; undo removes it
    summary,
    decisions, // what was agreed before this version was written: [{ item, decision, why? }]
    comments: answers, // the open comments this version answers; resolved on apply, reopened on undo
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
    proposal.comments_resolved = await settle(dir, proposal, 'auto');
  }
  return store(dir, proposal);
}

export async function applyProposal(dir, { id, approved_by }) {
  if (!approved_by) throw new Error('apply needs approved_by: the person who said yes');
  const p = await load(dir, id);
  if (p.status !== 'pending') throw new Error(`proposal "${id}" is ${p.status}, not pending`);
  // a file the proposal creates must still be absent; an existing one must be as it was
  const current = existsSync(p.file) ? await readFile(p.file, 'utf8') : '';
  if (sha(current) !== p.base_hash) throw new Error(`"${p.screen}" changed since the proposal was made; propose again`);
  await write(dir, p, p.after);
  Object.assign(p, { status: 'applied', approved_by, applied_at: new Date().toISOString() });
  p.comments_resolved = await settle(dir, p, approved_by);
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
  // undoing a proposal that created the file removes the file, not writes an empty one
  if (p.creates) await unlink(p.file);
  else await write(dir, p, p.before);
  // the comments it had resolved are open again
  for (const cid of p.comments_resolved ?? []) {
    try {
      await reopenComment(dir, { id: cid });
    } catch {
      /* resolved again by hand since, or gone */
    }
  }
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
