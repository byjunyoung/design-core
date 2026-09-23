import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { DEFAULT_TOKENS } from './render/tokens.js';

// A project starts by choosing what its screens are drawn with. Either a component library
// the team already uses — then each kind maps to one of its components — or nothing: the
// bundled set is copied into the project and becomes the team's own component library,
// theirs to edit, 100%. The tool never owns a team's components either way.

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export function componentBases() {
  return [
    { id: 'none', label: 'Self-built (100% yours)', status: 'ready', note: 'the bundled set is copied into your project and becomes your component library' },
    { id: 'antd', label: 'Ant Design', status: 'ready', note: 'kinds map to antd components, drawn server-side and themed from tokens.json' },
    { id: 'mui', label: 'MUI', status: 'planned', note: 'adapter not written yet; the antd adapter is the model' },
    { id: 'shadcn', label: 'shadcn/ui', status: 'planned', note: 'adapter not written yet' },
  ];
}

export async function initProject(dir, { base = 'none' } = {}) {
  const chosen = componentBases().find((b) => b.id === base);
  if (!chosen) throw new Error(`unknown base "${base}"; choose one of ${componentBases().map((b) => b.id).join(', ')}`);
  if (chosen.status !== 'ready') throw new Error(`base "${base}" is planned, not ready — choose "none" (self-built) or "antd"`);
  if (existsSync(join(dir, 'conventions.yaml'))) throw new Error(`${dir} already has a conventions.yaml; init writes only into an empty project`);

  await mkdir(join(dir, 'screens'), { recursive: true });
  const created = [];

  // conventions: the example, with the render section set and, for self-built, no maps_to.
  const doc = parseDocument(await readFile(here('../conventions.example.yaml'), 'utf8'));
  doc.setIn(['render', 'base'], base);
  if (base === 'none') {
    doc.setIn(['render', 'components'], './components/kinds.js');
    const kinds = doc.get('kinds');
    for (const pair of kinds.items) if (pair.value?.has?.('maps_to')) pair.value.delete('maps_to');
  } else {
    doc.setIn(['render', 'components'], null);
    for (const pair of doc.get('kinds').items) {
      const m = pair.value?.get?.('maps_to');
      if (m && typeof m.get === 'function') for (const k of [...m.items.map((i) => i.key.value)]) if (k !== base) m.delete(k);
    }
  }
  await writeFile(join(dir, 'conventions.yaml'), doc.toString({ lineWidth: 0 }));
  created.push('conventions.yaml');

  await writeFile(join(dir, 'sections.yaml'), '[]\n');
  created.push('sections.yaml');
  await writeFile(join(dir, 'tokens.json'), JSON.stringify(DEFAULT_TOKENS, null, 2) + '\n');
  created.push('tokens.json');

  if (base === 'none') {
    await mkdir(join(dir, 'components'), { recursive: true });
    await copyFile(here('./render/kinds.js'), join(dir, 'components', 'kinds.js'));
    created.push('components/kinds.js');
  }
  return { dir, base, created };
}
