import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { DEFAULT_TOKEN_FILES } from './tokens.js';

// A project starts by choosing what its screens are drawn with. Either a component library
// the team already uses — then each kind maps to one of its components — or nothing: the
// bundled set is copied into the project and becomes the team's own component library,
// theirs to edit, 100%. The tool never owns a team's components either way.

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export function componentBases() {
  return [
    { id: 'none', label: 'Self-built (100% yours)', status: 'ready', note: 'the bundled set is copied into your project and becomes your component library' },
    { id: 'antd', label: 'Ant Design', status: 'ready', note: 'kinds map to antd components, drawn server-side and themed from tokens/' },
    { id: 'mui', label: 'MUI', status: 'ready', note: 'kinds map to MUI components, drawn server-side through emotion and themed from tokens/' },
    { id: 'shadcn', label: 'shadcn/ui', status: 'n/a', note: 'shadcn is copied source in your repo, not a package: start with --base none and point render.components at your own module' },
  ];
}

const STARTER_SCREEN = `schema: doan/0.2
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

Screens as files. One YAML per screen under \`screens/\`; the rules in \`conventions.yaml\`; the theme in \`tokens/\` (DTCG files: primitives, semantic, light, dark, and the resolver); your icons and pictures in \`assets/\`, named by path from a screen (\`src: assets/photos/menu.jpg\`).

Component base: **${base}**${base === 'none' ? ' — the component set is in `components/kinds.js` and is yours to edit.' : ' — kinds map to that library through `maps_to` in `components/<kind>.yaml`.'}

\`\`\`bash
npx doan lint .          # what is missing
npx doan serve .         # the viewer at http://127.0.0.1:4870/
npx doan mcp .           # the same verbs for an agent (see the project root README for client config)
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
  doc.setIn(['render', 'components'], base === 'none' ? './components/kinds.js' : null);
  if (doc.has('kinds')) doc.delete('kinds'); // kinds are files now (components/<kind>.yaml); the block is read only as legacy
  await writeFile(join(dir, 'conventions.yaml'), doc.toString({ lineWidth: 0 }));

  // components/: every bundled contract, its maps_to trimmed to the chosen base. From here on
  // the registry is the team's — a kind is a file they edit, not a row the tool owns.
  await mkdir(join(dir, 'components'), { recursive: true });
  for (const name of (await readdir(here('./contracts/'))).filter((n) => n.endsWith('.yaml')).sort()) {
    const cdoc = parseDocument(await readFile(here(`./contracts/${name}`), 'utf8'));
    const m = cdoc.get('maps_to');
    if (base === 'none') cdoc.delete('maps_to');
    else if (m && typeof m.get === 'function') {
      for (const k of [...m.items.map((i) => i.key.value)]) if (k !== base && k !== 'figma') m.delete(k);
      if (!m.items.length) cdoc.delete('maps_to');
    }
    await writeFile(join(dir, 'components', name), cdoc.toString({ lineWidth: 0 }));
  }
  created.push('components/<kind>.yaml');
  created.push('conventions.yaml');

  await writeFile(join(dir, 'sections.yaml'), '- "00. Sample - delete me"\n');
  created.push('sections.yaml');
  // A first screen, so the viewer has something to show and the format has an example in
  // the project itself. Delete it once a real screen exists.
  await writeFile(join(dir, 'screens', 'sample-list.yaml'), STARTER_SCREEN);
  created.push('screens/sample-list.yaml');
  await writeFile(join(dir, 'README.md'), PROJECT_README(base));
  created.push('README.md');
  // tokens/: DTCG files — primitives, the fixed semantic set, one colour file per theme, and
  // the resolver that says how they combine. Resolved for light this is the bundled default.
  // assets/: the person's icons and pictures, named by path from a screen (src/assets.js)
  await mkdir(join(dir, 'assets'), { recursive: true });
  await writeFile(join(dir, 'assets', '.gitkeep'), '');
  await mkdir(join(dir, 'tokens'), { recursive: true });
  for (const [name, body] of Object.entries(DEFAULT_TOKEN_FILES)) {
    await writeFile(join(dir, 'tokens', name), JSON.stringify(body, null, 2) + '\n');
    created.push(`tokens/${name}`);
  }

  if (base === 'none') {
    await mkdir(join(dir, 'components'), { recursive: true });
    await copyFile(here('./render/kinds.js'), join(dir, 'components', 'kinds.js'));
    await copyFile(here('./render/i18n.js'), join(dir, 'components', 'i18n.js')); // kinds.js imports it; the copy stays self-contained
    created.push('components/kinds.js');
  }
  return { dir, base, created };
}
