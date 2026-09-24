import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';

// Components as files. One YAML per kind under components/ — its props, the token slots the
// picture reads, per-variant overrides, and for a compound part the elements it is made of.
// The registry is what every reader asks: lint (which props a kind declares), render (what
// maps_to and which slots), import (maps_to.figma). A kind that is still a row in
// conventions.kinds — the shape before 0.4 — is read too, marked `legacy`, so nothing
// breaks the day the files arrive; L23 says to move it.

// Keys on an element that are never props: identity, structure, conditions, repetition.
export const RESERVED_KEYS = new Set(['id', 'kind', 'children', 'show_when', 'disabled_when', 'reveals', 'repeat', 'slots', 'slot']);

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

export async function loadComponents(dir, conventions = {}) {
  const registry = {};
  const files = [];
  const problems = [];
  let names = [];
  try {
    names = (await readdir(join(dir, 'components'))).filter((n) => /\.ya?ml$/.test(n)).sort();
  } catch {
    names = [];
  }
  for (const n of names) {
    const file = join(dir, 'components', n);
    files.push(file);
    try {
      const doc = parse(await readFile(file, 'utf8'));
      const kind = (isObj(doc) && typeof doc.kind === 'string' ? doc.kind : null) ?? n.replace(/\.ya?ml$/, '');
      registry[kind] = { ...(isObj(doc) ? doc : {}), kind, file };
    } catch (err) {
      problems.push({ severity: 'blocking', file, path: '', message: `cannot read ${n}: ${err.message}` });
    }
  }
  const legacy = [];
  for (const [kind, def] of Object.entries(conventions?.kinds ?? {})) {
    if (registry[kind]) continue;
    registry[kind] = { kind, ...(isObj(def) ? def : {}), legacy: true, file: null };
    legacy.push(kind);
  }
  return { registry, files, legacy, problems };
}

// The props an element carries, minus the reserved keys: what lint checks against the contract.
export function elementProps(el) {
  return Object.fromEntries(Object.entries(el).filter(([k]) => !RESERVED_KEYS.has(k)));
}

// Which enum and boolean props an element sets, for the wrapper's data attributes — what a
// variant's css binds to. Defaults count, so a variant rule matches a button that never said
// `variant: default`, and `selected: true` on a chip reads as data-selected="true".
export function enumAttrs(contract, el) {
  const out = {};
  for (const [name, def] of Object.entries(contract?.props ?? {})) {
    if (def?.type !== 'enum' && def?.type !== 'boolean') continue;
    const value = el[name] ?? def.default;
    if (typeof value === 'string' || typeof value === 'boolean') out[name] = String(value);
  }
  return out;
}
