import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { stringify, parse } from 'yaml';

// The on-ramp for a team that already drew everything in Figma. A page's frames named
// `{screen}-{state}` become one screen file each; the other state frames become patches
// against Default; instances become kinds through `maps_to.figma` on the master's name,
// then through the node's own name; auto-layout becomes `layout` in token names. Whatever
// this cannot resolve lands as `$tbd` owned by "import", so the first lint after an import
// is the to-do list, not a guess.

export const KIND_HINTS = [
  ['pagination', /pag(er|ination|inat)/i],
  ['skeleton', /skeleton|loading/i],
  ['empty-notice', /empty|no data|nothing/i],
  ['error-notice', /error|fail/i],
  ['date-range', /range ?picker|date ?range/i],
  ['date', /date ?picker|calendar|datepicker/i],
  ['filter-form', /filter/i],
  ['page-header', /page ?header|title bar|topbar|top bar/i],
  ['nav', /^nav|navigation|sidebar|side ?nav|menu$/i],
  ['table', /table|grid|list$/i],
  ['checkbox', /checkbox|check box/i],
  ['radio', /radio/i],
  ['switch', /switch|toggle/i],
  ['button', /button|btn|cta/i],
  ['tabs', /tabs?$/i],
  ['modal', /modal|dialog/i],
  ['tooltip', /tooltip|popover/i],
  ['tag', /badge|tag|chip|pill/i],
  ['card', /card|panel/i],
  ['select', /select|dropdown/i],
  ['textarea', /textarea/i],
  ['input', /input|field|textbox/i],
  ['segmented', /segment/i],
  ['divider', /divider|separator/i],
  ['image', /image|illustration|avatar|logo/i],
  ['group', /header|footer|toolbar|actions|row|group/i],
];

// Layer names that carry no meaning of their own: a container Figma auto-named, or one a
// designer named for where it sits. They become bare groups, not open questions.
const WRAPPER = /^(frame \d+|group \d+|wrapper|container|contents?|contents?-body|body|inner|outer|left|right|top|bottom|main|area|section \d*)$/i;

const slug = (name) =>
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[^a-z]/, 'n$&') || 'node';

const texts = (node) => {
  const out = [];
  const walk = (n) => {
    if (n.visible === false) return;
    if (n.type === 'TEXT' && n.characters) out.push(n.characters);
    for (const c of n.children ?? []) walk(c);
  };
  walk(node);
  return out;
};

function tokenFor(px, tokens, group = 'space') {
  const entries = Object.entries(tokens?.[group] ?? {}).map(([k, v]) => [k, parseFloat(v)]).filter(([, v]) => !Number.isNaN(v));
  if (!entries.length || px === undefined) return null;
  const [name] = entries.reduce((best, cur) => (Math.abs(cur[1] - px) < Math.abs(best[1] - px) ? cur : best));
  return `${group}.${name}`;
}

function layoutOf(node, tokens) {
  if (!node.layoutMode || node.layoutMode === 'NONE') return null;
  const rule = { kind: 'stack', direction: node.layoutMode === 'HORIZONTAL' ? 'row' : 'column' };
  const gap = tokenFor(node.itemSpacing, tokens);
  if (gap && node.itemSpacing) rule.gap = gap;
  const pad = Math.max(node.paddingLeft ?? 0, node.paddingTop ?? 0, node.paddingRight ?? 0, node.paddingBottom ?? 0);
  const padding = tokenFor(pad || undefined, tokens);
  if (padding && pad) rule.padding = padding;
  return rule;
}

function makeResolver(file, conventions) {
  const byFigma = {};
  for (const [kind, def] of Object.entries(conventions.kinds ?? {}))
    for (const name of [].concat(def?.maps_to?.figma ?? [])) byFigma[name] = kind;
  const masterName = (node) => {
    const c = file.components?.[node.componentId];
    if (!c) return null;
    const set = c.componentSetId && file.componentSets?.[c.componentSetId];
    return set ? set.name : c.name; // a variant's own name is "type=primary"; the set carries the real name
  };
  return (node) => {
    const master = masterName(node);
    if (master && byFigma[master]) return { kind: byFigma[master], via: 'maps_to.figma' };
    for (const candidate of [master, node.name].filter(Boolean))
      for (const [kind, re] of KIND_HINTS) if (re.test(candidate)) return { kind, via: `name "${candidate}"` };
    return null;
  };
}

// Builds the element tree of one frame. Decoration (vectors, rectangles, lines) is skipped;
// text becomes props on its nearest element or a caption of its own.
function elementsOf(frame, resolve, tokens, layout, ids = new Set()) {
  const out = [];
  const children = frame.children ?? [];
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.visible === false) continue;
    // A run of instances of the same master (a grid of tiles, a list of rows) is one
    // element repeated, not a hundred elements: `repeat` says how many the page showed.
    if (node.type === 'INSTANCE' && node.componentId) {
      let run = 1;
      while (children[i + run]?.type === 'INSTANCE' && children[i + run].componentId === node.componentId) run++;
      if (run > 1) {
        const el = elementsOf({ children: [node] }, resolve, tokens, layout, ids)[0];
        if (el) out.push({ ...el, repeat: run });
        i += run - 1;
        continue;
      }
    }
    if (['VECTOR', 'RECTANGLE', 'ELLIPSE', 'LINE', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON'].includes(node.type)) continue;
    let id = slug(node.name);
    while (ids.has(id)) id = `${id}-2`;
    ids.add(id);
    if (node.type === 'TEXT') {
      out.push({ id, kind: 'caption', text: node.characters ?? '' });
      continue;
    }
    const hit = resolve(node) ?? (WRAPPER.test(node.name) && node.children?.length ? { kind: 'group', via: 'wrapper name' } : null);
    const el = { id, kind: hit?.kind ?? 'frame' };
    const strings = texts(node);
    if (!hit) el.resolve = { $tbd: { owner: 'import', note: `kind not resolved from Figma node "${node.name}"` } };
    switch (el.kind) {
      case 'button':
        el.label = strings[0] ?? node.name;
        break;
      case 'table':
        el.columns = strings;
        break;
      case 'filter-form':
        el.fields = strings;
        break;
      case 'empty-notice':
      case 'error-notice':
      case 'caption':
        if (strings[0]) el.text = strings[0];
        break;
      case 'page-header':
        if (strings[0]) el.title = strings[0];
        break;
      default:
        break;
    }
    const isContainer = ['FRAME', 'GROUP', 'SECTION'].includes(node.type) && !['table', 'filter-form', 'empty-notice', 'skeleton', 'pagination', 'button'].includes(el.kind);
    if (isContainer && node.children?.length) {
      const children = elementsOf(node, resolve, tokens, layout, ids);
      if (children.length) el.children = children;
      const rule = layoutOf(node, tokens);
      if (rule) layout[id] = rule;
    }
    out.push(el);
  }
  return out;
}

// Turns the difference between Default's tree and a state's tree into patches. Elements
// are matched by id; a kind change is a replace, a prop change a set, an absence a hide.
function patchesFor(defaults, stateElements) {
  const flat = (list, acc = {}) => {
    for (const e of list) {
      acc[e.id] = e;
      if (e.children) flat(e.children, acc);
    }
    return acc;
  };
  const a = flat(defaults);
  const b = flat(stateElements);
  const patches = [];
  const hidden = new Set();
  const under = (list, acc = new Set()) => {
    for (const e of list) {
      acc.add(e.id);
      if (e.children) under(e.children, acc);
    }
    return acc;
  };
  for (const [id, el] of Object.entries(a)) {
    if (hidden.has(id)) continue; // its parent is already hidden; a patch on it would target nothing
    const other = b[id];
    if (!other) {
      patches.push({ target: id, hide: true });
      for (const d of under(el.children ?? [])) hidden.add(d);
      continue;
    }
    const strip = ({ id: _i, children: _c, resolve: _r, ...rest }) => rest;
    const pa = strip(el);
    const pb = strip(other);
    if (pa.kind !== pb.kind) {
      patches.push({ target: id, replace: pb });
      continue;
    }
    const changed = Object.fromEntries(Object.entries(pb).filter(([k, v]) => k !== 'kind' && JSON.stringify(v) !== JSON.stringify(pa[k])));
    if (Object.keys(changed).length) patches.push({ target: id, set: changed });
  }
  return patches;
}

function typeFor(states, conventions) {
  const required = conventions.states?.required ?? {};
  let best = null;
  for (const [type, list] of Object.entries(required)) {
    const overlap = list.filter((s) => s !== 'Default' && states.includes(s)).length;
    if (!best || overlap > best.overlap || (overlap === best.overlap && list.length > best.length)) best = { type, overlap, length: list.length };
  }
  return best && best.overlap > 0 ? best.type : 'unknown';
}

// How a frame name splits into screen and state. A team writes a regex with two groups, or
// names one of these presets.
const FRAME_PRESETS = {
  'screen-state': '^(.+)-([^-\\s]+)$', // order-list-Empty
  'screen/state': '^(.+?)\\s*/\\s*([^/]+?)\\s*$', // Orders / Empty
  'screen state': '^(.+)\\s+(\\S+)$', // Orders Empty
  'screen=state': '^(.+?)\\s*=\\s*(.+)$', // Orders=Empty
};
function framePattern(conventions) {
  const raw = conventions.naming?.frame_pattern ?? 'screen-state';
  return new RegExp(FRAME_PRESETS[raw] ?? raw, 'u');
}

export function importFigmaTree(file, { page, conventions, tokens = {}, fileKey = '' }) {
  const canvas = (file.document?.children ?? []).find((c) => c.type === 'CANVAS' && (!page || c.name === page));
  if (!canvas) throw new Error(`no page named "${page}" in the file (have: ${(file.document?.children ?? []).map((c) => c.name).join(', ')})`);
  const resolve = makeResolver(file, conventions);
  const pattern = framePattern(conventions);
  const groups = {};
  const sections = [];
  const frameToScreen = {};
  const importSection = '00. Imported';

  const excluded = (conventions.pages?.exclude_sections ?? []).map((re) => new RegExp(re, 'u'));
  // Scaffolding a flow tool leaves on the page — arrow labels, state chains — is not a screen.
  const scaffold = (conventions.naming?.scaffold_patterns ?? ['^\\[label\\] ', '^\\[state\\] ', ' --> ', ' ~ ']).map((re) => new RegExp(re, 'u'));
  const loose = [];

  const visit = (node, section) => {
    if (node.type === 'SECTION') {
      if (excluded.some((re) => re.test(node.name))) return;
      if (!sections.includes(node.name)) sections.push(node.name);
      for (const c of node.children ?? []) visit(c, node.name);
      return;
    }
    if (node.type !== 'FRAME' && node.type !== 'COMPONENT') return;
    if (scaffold.some((re) => re.test(node.name))) return;
    const m = node.name.match(pattern);
    if (!m || m.length < 3) {
      loose.push({ node, section });
      return;
    }
    const [, screen, state] = m;
    (groups[screen] ??= { section: section ?? importSection, frames: {} }).frames[state] = node;
    frameToScreen[node.id] = { screen, state };
  };
  for (const node of canvas.children ?? []) visit(node, null);

  // No frame followed {screen}-{state}: a file drawn without the convention. Every top-level
  // frame is then a screen of its own, named by its name and, on collision, its position —
  // and the note on each says so, because the name is the importer's, not the team's.
  const fallback = Object.keys(groups).length === 0 && loose.length > 0;
  if (fallback) {
    const taken = new Set();
    for (const { node, section } of loose) {
      let screen = slug(node.name);
      let n = 1;
      while (taken.has(screen)) screen = `${slug(node.name)}-${++n}`;
      taken.add(screen);
      groups[screen] = { section: section ?? importSection, frames: { Default: node }, renamed: node.name };
      frameToScreen[node.id] = { screen, state: 'Default' };
    }
  }
  if (Object.values(groups).some((g) => g.section === importSection) && !sections.includes(importSection)) sections.unshift(importSection);

  const screens = [];
  let tbd = 0;
  for (const [screen, group] of Object.entries(groups)) {
    const defaultFrame = group.frames.Default ?? Object.values(group.frames)[0];
    const layout = {};
    const elements = elementsOf(defaultFrame, resolve, tokens, layout);
    const root = layoutOf(defaultFrame, tokens);
    if (root) layout.root = root;
    const states = {};
    for (const [state, frame] of Object.entries(group.frames)) {
      if (frame === defaultFrame) continue;
      states[state] = patchesFor(elements, elementsOf(frame, resolve, tokens, {}));
    }
    const type = typeFor(Object.keys(states), conventions);
    // Required states the page never drew: stub them, so lint reports them rather than a person finding out later.
    for (const state of conventions.states?.required?.[type] ?? [])
      if (state !== 'Default' && !states[state] && elements[0])
        states[state] = [{ target: elements[0].id, replace: { kind: 'placeholder', text: { $tbd: { owner: 'import', note: `${state} state was not drawn in Figma` } } } }];
    const flows = [];
    const walkFlows = (node, fromId) => {
      const target = node.transitionNodeID && frameToScreen[node.transitionNodeID];
      if (target) flows.push({ from: fromId ?? slug(node.name), to: target.state === 'Default' ? target.screen : `${target.screen}.${target.state}` });
      for (const c of node.children ?? []) walkFlows(c, node.type === 'TEXT' ? fromId : slug(node.name));
    };
    for (const c of defaultFrame.children ?? []) walkFlows(c, null);
    const seen = new Set();
    const dedup = flows.filter((f) => !seen.has(`${f.from}>${f.to}`) && seen.add(`${f.from}>${f.to}`));

    const doc = {
      schema: 'design-core/0.2',
      id: `scr_${defaultFrame.id.replace(/[^A-Za-z0-9]/g, '')}`,
      screen,
      section: group.section,
      type,
      refs: fileKey ? { design: `figma:${fileKey}/${defaultFrame.id}` } : {},
      elements,
      ...(Object.keys(layout).length ? { layout } : {}),
      ...(Object.keys(states).length ? { states } : {}),
      ...(dedup.length ? { flows: dedup } : {}),
      notes: [
        `imported from Figma page "${canvas.name}" on ${new Date().toISOString().slice(0, 10)}`,
        ...(group.renamed ? [`TBD: the Figma frame "${group.renamed}" did not follow {screen}-{state}; "${screen}" is the importer's name — rename it`] : []),
        ...(type === 'unknown' ? ['TBD: screen type could not be read off the states; set `type`'] : []),
      ],
    };
    tbd += (JSON.stringify(doc).match(/"\$tbd"/g) ?? []).length;
    screens.push({ screen, doc, text: stringify(doc, { lineWidth: 0 }) });
  }
  return { page: canvas.name, sections, screens, tbd, fallback };
}

export async function writeImport(dir, result, { force = false } = {}) {
  const files = [];
  for (const s of result.screens) {
    const file = join(dir, 'screens', `${s.screen}.yaml`);
    if (existsSync(file) && !force) throw new Error(`${file} exists; pass --force to overwrite, or rename the Figma frame`);
    await writeFile(file, s.text);
    files.push(file);
  }
  const sectionsFile = join(dir, 'sections.yaml');
  const existing = existsSync(sectionsFile) ? parse(await readFile(sectionsFile, 'utf8')) ?? [] : [];
  const merged = [...existing, ...result.sections.filter((s) => !existing.includes(s))];
  await writeFile(sectionsFile, stringify(merged));
  return { files, sections: merged, tbd: result.tbd };
}

// Figma REST: the page list first (depth 1), then that page's subtree. Needs FIGMA_TOKEN.
export async function fetchFigmaPage(fileKey, page, { token = process.env.FIGMA_TOKEN } = {}) {
  if (!token) throw new Error('FIGMA_TOKEN is not set; a personal access token with file read is needed');
  const headers = { 'X-Figma-Token': token };
  const list = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=1`, { headers });
  if (!list.ok) throw new Error(`Figma ${list.status} listing pages of ${fileKey}`);
  const meta = await list.json();
  const canvas = meta.document.children.find((c) => c.name === page);
  if (!canvas) throw new Error(`no page named "${page}" (have: ${meta.document.children.map((c) => c.name).join(', ')})`);
  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(canvas.id)}`, { headers });
  if (!res.ok) throw new Error(`Figma ${res.status} fetching page "${page}"`);
  const body = await res.json();
  const node = body.nodes[canvas.id];
  return { name: meta.name, components: node.components ?? {}, componentSets: node.componentSets ?? {}, document: { children: [node.document] } };
}
