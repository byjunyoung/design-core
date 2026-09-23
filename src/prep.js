import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { parseDocument, parse } from 'yaml';
import { findElement } from './elements.js';

// prep stubs every state the screen's type requires and the file lacks, as a placeholder
// patch that lint counts as $tbd. It edits the file through the Document API so comments
// and key order survive. The stub is honest scaffolding, not a design: one placeholder on
// one element, for a person or an agent to replace.
export async function prepFile(file, { projectDir = dirname(dirname(file)), target, owner } = {}) {
  const conventions = parse(await readFile(join(projectDir, 'conventions.yaml'), 'utf8'));
  const text = await readFile(file, 'utf8');
  const document = parseDocument(text);
  const doc = document.toJS();

  const required = conventions.states?.required?.[doc.type] ?? [];
  const missing = required.filter((s) => s !== 'Default' && !doc.states?.[s]);
  if (!missing.length) return { file, added: [], target: null };

  const elements = doc.elements ?? [];
  const targetId = target ?? elements[0]?.id;
  if (!targetId) throw new Error(`${file}: no element to attach a placeholder to`);
  if (!findElement(elements, targetId)) throw new Error(`${file}: "${targetId}" is not an element`);

  for (const state of missing) {
    const tbd = { note: `${state} state not designed yet` };
    if (owner) tbd.owner = owner;
    const patch = { target: targetId, replace: { kind: 'placeholder', text: { $tbd: owner ? { owner, note: tbd.note } : tbd } } };
    document.setIn(['states', state], [patch]);
  }
  await writeFile(file, document.toString({ lineWidth: 0 }));
  return { file, added: missing, target: targetId };
}
