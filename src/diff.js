import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

// Elements are compared by id, never by index: a reorder is one entry, a change on the
// second element is reported as `elements.<id>.<prop>`. Every other area diffs by key.
const isElement = (v) => v && typeof v === 'object' && !Array.isArray(v) && typeof v.id === 'string' && typeof v.kind === 'string';

function keyElements(list) {
  const byId = {};
  for (const el of list) byId[el.id] = normalize(el);
  return { byId, order: list.map((e) => e.id) };
}

function normalize(value) {
  if (Array.isArray(value)) {
    if (value.length && value.every(isElement)) return { __elements: keyElements(value) };
    return value.map(normalize);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalize(v);
    return out;
  }
  return value;
}

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function walk(before, after, path, out) {
  if (before?.__elements || after?.__elements) {
    const b = before?.__elements ?? { byId: {}, order: [] };
    const a = after?.__elements ?? { byId: {}, order: [] };
    const shared = b.order.filter((id) => id in a.byId);
    const sharedAfter = a.order.filter((id) => id in b.byId);
    if (!equal(shared, sharedAfter)) out.changed.push({ path: [...path, '(order)'], before: b.order, after: a.order });
    for (const id of Object.keys({ ...b.byId, ...a.byId })) walk(b.byId[id], a.byId[id], [...path, id], out);
    return;
  }
  if (before === undefined) return out.added.push({ path, after: denormalize(after) });
  if (after === undefined) return out.removed.push({ path, before: denormalize(before) });
  const plain = (v) => v === null || typeof v !== 'object';
  if (plain(before) || plain(after) || Array.isArray(before) !== Array.isArray(after)) {
    if (!equal(before, after)) out.changed.push({ path, before: denormalize(before), after: denormalize(after) });
    return;
  }
  // A list of scalars (columns, fields) is one value. A list of objects (flows, patches)
  // diffs by index, so a shorter list reports removals.
  const scalars = (v) => v.every(plain);
  if (Array.isArray(before) && ((before.length && scalars(before)) || (after.length && scalars(after)))) {
    if (!equal(before, after)) out.changed.push({ path, before: denormalize(before), after: denormalize(after) });
    return;
  }
  const keys = Array.isArray(before)
    ? Array.from({ length: Math.max(before.length, after.length) }, (_, i) => i)
    : Object.keys({ ...before, ...after });
  for (const k of keys) walk(before[k], after[k], [...path, k], out);
}

function denormalize(value) {
  if (value?.__elements) return value.__elements.order.map((id) => denormalize(value.__elements.byId[id]));
  if (Array.isArray(value)) return value.map(denormalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = denormalize(v);
    return out;
  }
  return value;
}

export function diffScreens(before, after) {
  const out = { added: [], removed: [], changed: [] };
  const nb = normalize(before);
  const na = normalize(after);
  // Elements at the top are an element list even when one side is empty.
  walk(nb, na, [], out);
  return out;
}

const cell = (v) => (v === undefined ? '' : '`' + JSON.stringify(v).replace(/\|/g, '\\|') + '`');

export function renderDiffMarkdown(diff, { screen = '' } = {}) {
  const rows = [
    ...diff.changed.map((e) => [e.path.join('.'), e.before, e.after]),
    ...diff.added.map((e) => [e.path.join('.'), undefined, e.after]),
    ...diff.removed.map((e) => [e.path.join('.'), e.before, undefined]),
  ];
  const head = screen ? `### ${screen} — AS-IS / TO-BE\n\n` : '';
  if (!rows.length) return `${head}No changes.\n`;
  return `${head}| Where | AS-IS | TO-BE |\n|---|---|---|\n${rows.map(([w, b, a]) => `| ${w} | ${cell(b)} | ${cell(a)} |`).join('\n')}\n`;
}

// Reads a screen from the working tree, or from a git ref (`main:design/screens/x.yaml`).
export function readScreenAt(file, ref, cwd = process.cwd()) {
  if (!ref) return parse(readFileSync(file, 'utf8'));
  const text = execFileSync('git', ['show', `${ref}:${file}`], { cwd, encoding: 'utf8' });
  return parse(text);
}
