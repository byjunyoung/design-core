import { readFile, writeFile } from 'node:fs/promises';
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

export function suggestFigmaMap(names, conventions) {
  const kinds = conventions.kinds ?? {};
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

export async function writeFigmaMap(dir, mapping) {
  const file = join(dir, 'conventions.yaml');
  const doc = parseDocument(await readFile(file, 'utf8'));
  const kinds = doc.get('kinds');
  const written = [];
  const skipped = [];
  for (const [kind, masters] of Object.entries(mapping)) {
    if (!kinds?.has?.(kind)) {
      skipped.push(kind);
      continue;
    }
    const current = [].concat(doc.getIn(['kinds', kind, 'maps_to', 'figma'], false)?.toJSON?.() ?? doc.getIn(['kinds', kind, 'maps_to', 'figma']) ?? []);
    const next = [...current, ...[].concat(masters).filter((m) => !current.includes(m))];
    if (next.length === current.length) continue;
    doc.setIn(['kinds', kind, 'maps_to', 'figma'], next.length === 1 ? next[0] : next);
    written.push(kind);
  }
  if (written.length) await writeFile(file, doc.toString({ lineWidth: 0 }));
  return { written, skipped };
}
