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
    { id: 'mui', label: 'MUI', status: 'ready', note: 'kinds map to MUI components, drawn server-side through emotion and themed from tokens.json' },
    { id: 'shadcn', label: 'shadcn/ui', status: 'n/a', note: 'shadcn is copied source in your repo, not a package: start with --base none and point render.components at your own module' },
  ];
}

const STARTER_SCREEN = `schema: design-core/0.2
id: scr_SAMPLE1
screen: sample-list             # a first screen so the viewer is not empty. Delete it when a real one exists.
section: "00. Sample - delete me"
type: list                      # list screens must have Empty, Loading and Error states (conventions.yaml)
refs:
  prd: file:README.md           # point this at the spec entry the screen answers to

elements:
  - id: header
    kind: page-header
    title: Sample list
    actions: [{ id: create, kind: button, label: New item, variant: primary }]
  - id: filter
    kind: filter-form
    fields: [period, status]
  - id: table
    kind: table
    columns: [name, status, updated_at]
  - id: paging
    kind: pagination
    page_size: 10

layout:
  root: { kind: stack, direction: column, gap: space.lg, padding: space.xl }
  header: { align: space-between }
  paging: { align: end }

states:                         # what changes from Default, and nothing else
  Empty:
    - { target: table, replace: { kind: empty-notice, title: Nothing here yet, text: Create the first item. } }
    - { target: paging, hide: true }
  Loading:
    - { target: table, replace: { kind: skeleton, rows: 6 } }
  Error:
    - { target: table, replace: { kind: error-notice, text: { $tbd: { owner: you, note: "decide the error copy" } } } }

notes:
  - This screen was written by init. The $tbd above shows how an undecided value looks in lint and in the viewer.
`;

const PROJECT_README = (base) => `# design

Screens as files. One YAML per screen under \`screens/\`; the rules in \`conventions.yaml\`; the theme in \`tokens.json\`.

Component base: **${base}**${base === 'none' ? ' — the component set is in `components/kinds.js` and is yours to edit.' : ' — kinds map to that library through `maps_to` in conventions.yaml.'}

\`\`\`bash
npx design-core lint .          # what is missing
npx design-core serve .         # the viewer at http://127.0.0.1:4870/
npx design-core mcp .           # the same verbs for an agent (see the project root README for client config)
\`\`\`

\`screens/sample-list.yaml\` is a starter; delete it when a real screen exists.
`;

export async function initProject(dir, { base = 'none' } = {}) {
  const chosen = componentBases().find((b) => b.id === base);
  if (!chosen) throw new Error(`unknown base "${base}"; choose one of ${componentBases().map((b) => b.id).join(', ')}`);
  if (chosen.status !== 'ready') throw new Error(`base "${base}": ${chosen.note}`);
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

  await writeFile(join(dir, 'sections.yaml'), '- "00. Sample - delete me"\n');
  created.push('sections.yaml');
  // A first screen, so the viewer has something to show and the format has an example in
  // the project itself. Delete it once a real screen exists.
  await writeFile(join(dir, 'screens', 'sample-list.yaml'), STARTER_SCREEN);
  created.push('screens/sample-list.yaml');
  await writeFile(join(dir, 'README.md'), PROJECT_README(base));
  created.push('README.md');
  await writeFile(join(dir, 'tokens.json'), JSON.stringify(DEFAULT_TOKENS, null, 2) + '\n');
  created.push('tokens.json');

  if (base === 'none') {
    await mkdir(join(dir, 'components'), { recursive: true });
    await copyFile(here('./render/kinds.js'), join(dir, 'components', 'kinds.js'));
    await copyFile(here('./render/i18n.js'), join(dir, 'components', 'i18n.js')); // kinds.js imports it; the copy stays self-contained
    created.push('components/kinds.js');
  }
  return { dir, base, created };
}
