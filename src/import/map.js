import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { KIND_HINTS } from './figma.js';

// Before an import is worth much, the file's component masters have to be named in
// `maps_to.figma` — that is what turns "kind: frame + $tbd" into "kind: table". This reads
// the masters a page uses, collapses variants into their component set, pairs each kind with
// one master by name, and writes the pairs into conventions.yaml through the Document API so
// the team's comments survive. What it cannot place is listed, not guessed.

export function masterNames(file) {
  const sets = file.componentSets ?? {};
  const names = new Set();
  for (const c of Object.values(file.components ?? {})) {
    const set = c.componentSetId && sets[c.componentSetId];
    names.add(set ? set.name : c.name);
  }
  return [...names];
}

// `registry` is project.components (kind → contract); a conventions object still works for
// the rows it carries in `kinds`.
export function suggestFigmaMap(names, registry) {
  const kinds = registry?.kinds && !registry?.kinds?.kind ? registry.kinds : (registry ?? {});
  const already = {};
  for (const [kind, def] of Object.entries(kinds)) if (def?.maps_to?.figma) already[kind] = [].concat(def.maps_to.figma);
  const mapped = {};
  const unmatched = [];
  // Every master that reads as a kind goes on that kind's list — "button", "button / icon",
  // "navigaition-button" are all buttons — shortest first so the plain one leads.
  for (const name of [...names].sort((a, b) => a.length - b.length)) {
    const hit = KIND_HINTS.find(([kind, re]) => kind in kinds && re.test(name));
    if (!hit) {
      unmatched.push(name);
      continue;
    }
    const [kind] = hit;
    if (already[kind]?.includes(name)) continue;
    (mapped[kind] ??= []).push(name);
  }
  return { mapped, unmatched, already };
}

// The pairs go where the kind lives: components/<kind>.yaml when that file exists, else the
// row in conventions.kinds a project from before 0.4 still has. A kind with neither is skipped.
export async function writeFigmaMap(dir, mapping) {
  const file = join(dir, 'conventions.yaml');
  const doc = parseDocument(await readFile(file, 'utf8'));
  const kinds = doc.get('kinds');
  const written = [];
  const skipped = [];
  let touchedConventions = false;
  const merge = (current, masters) => {
    const have = [].concat(current ?? []);
    const next = [...have, ...[].concat(masters).filter((m) => !have.includes(m))];
    return next.length === have.length ? null : next.length === 1 ? next[0] : next;
  };
  for (const [kind, masters] of Object.entries(mapping)) {
    const target = join(dir, 'components', `${kind}.yaml`);
    if (existsSync(target)) {
      const cdoc = parseDocument(await readFile(target, 'utf8'));
      const next = merge(cdoc.getIn(['maps_to', 'figma'], false)?.toJSON?.() ?? cdoc.getIn(['maps_to', 'figma']), masters);
      if (next === null) continue;
      cdoc.setIn(['maps_to', 'figma'], next);
      await writeFile(target, cdoc.toString({ lineWidth: 0 }));
      written.push(kind);
      continue;
    }
    if (!kinds?.has?.(kind)) {
      skipped.push(kind);
      continue;
    }
    const next = merge(doc.getIn(['kinds', kind, 'maps_to', 'figma'], false)?.toJSON?.() ?? doc.getIn(['kinds', kind, 'maps_to', 'figma']), masters);
    if (next === null) continue;
    doc.setIn(['kinds', kind, 'maps_to', 'figma'], next);
    touchedConventions = true;
    written.push(kind);
  }
  if (touchedConventions) await writeFile(file, doc.toString({ lineWidth: 0 }));
  return { written, skipped };
}
