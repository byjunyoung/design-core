import { relative } from 'node:path';
import { walkElements } from './elements.js';
import { lint, summarize, bindingsOf } from './lint.js';
import { DEFAULT_TOKENS, mergeTokens } from './render/tokens.js';
import { getToken, hasToken } from './tokens.js';
import { assetRefs } from './assets.js';
import { dictionary, languageOf } from './render/i18n.js';
import { RESERVED_KEYS } from './components.js';

// The developer spec of one screen: everything a person or a coding agent needs to build it,
// read off the file — elements with their props and copy, the component each maps to in code,
// what every state, variant and breakpoint changes, the flows out, the tokens and assets used,
// the open questions, and acceptance criteria written from all of that. One structure feeds
// the spec page, `doan spec`, and the MCP `handoff` tool (DESIGN.md §6.10). Nothing here is
// stored: the file is the truth, the spec is a reading of it.

const COPY_PROPS = ['text', 'label', 'title', 'subtitle', 'placeholder', 'caption', 'hint', 'note', 'alt', 'error', 'summary'];
const COPY_LISTS = ['options', 'tabs', 'stats', 'items', 'buttons', 'actions'];
const fmt = (tpl, vars) => String(tpl ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
const short = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
const isTbd = (v) => v && typeof v === 'object' && !Array.isArray(v) && '$tbd' in v;

function* walkTbd(value, path = []) {
  if (value === null || typeof value !== 'object') return;
  if (isTbd(value)) {
    yield { path, meta: value.$tbd ?? {} };
    return;
  }
  const entries = Array.isArray(value) ? value.map((v, i) => [i, v]) : Object.entries(value);
  for (const [k, v] of entries) yield* walkTbd(v, [...path, k]);
}

function describeChange(D, p) {
  if (p.hide) return D.chHide;
  if (p.replace) return fmt(D.chReplace, { kind: p.replace.kind + (p.replace.title ? ` "${p.replace.title}"` : p.replace.text ? ` "${p.replace.text}"` : '') });
  if (p.set) return fmt(D.chSet, { what: Object.entries(p.set).map(([k, v]) => `${k}=${short(v)}`).join(', ') });
  if (p.layout) return fmt(D.chLayout, { what: Object.entries(p.layout).map(([k, v]) => `${k}=${short(v)}`).join(', ') });
  return '';
}

// What an element is in the team's code, from its contract's `maps_to.code` — the import, the
// component name, and this element's props translated by the mapping's `props` and `values`.
// A framework-neutral snippet is written from that; a team's own generator can do better.
export function codeOf(contract, el) {
  const code = contract?.maps_to?.code;
  if (!code || typeof code !== 'object') return null;
  const props = {};
  for (const [k, v] of Object.entries(el)) {
    if (RESERVED_KEYS.has(k) || k.startsWith('$') || isTbd(v)) continue;
    const name = code.props?.[k] ?? k;
    const value = code.values?.[k]?.[String(v)] ?? v;
    props[name] = value;
  }
  const name = code.name ?? contract.kind;
  const children = props.children;
  delete props.children;
  const attrs = Object.entries(props)
    .filter(([, v]) => typeof v !== 'object')
    .map(([k, v]) => (v === true ? k : typeof v === 'string' ? `${k}="${v}"` : `${k}={${JSON.stringify(v)}}`))
    .join(' ');
  const snippet = children !== undefined ? `<${name}${attrs ? ' ' + attrs : ''}>${short(children)}</${name}>` : `<${name}${attrs ? ' ' + attrs : ''} />`;
  return { import: code.import ?? null, name, props, snippet, note: code.note ?? null };
}

export function specOf(project, screen, { branch = null } = {}) {
  const D = dictionary(languageOf(project));
  const doc = screen.doc;
  const conventions = project.conventions ?? {};
  const registry = project.components ?? {};
  const merged = mergeTokens(DEFAULT_TOKENS, project.tokens);
  const findings = lint(project, { branch }).filter((f) => f.file === screen.file);

  // elements, flat, each with its parent, props as written, conditions, copy and code
  const byPath = new Map();
  const elements = [];
  const copy = [];
  for (const { el, path } of walkElements(doc.elements ?? [], ['elements'])) {
    const key = path.join('.');
    let parent = null;
    for (let i = path.length - 1; i > 0 && !parent; i--) parent = byPath.get(path.slice(0, i).join('.')) ?? null;
    byPath.set(key, el.id);
    const contract = registry[el.kind] ?? null;
    const props = Object.fromEntries(Object.entries(el).filter(([k]) => !RESERVED_KEYS.has(k) && !k.startsWith('$') && !['show_when', 'disabled_when', 'reveals'].includes(k)));
    const conditions = {};
    for (const k of ['show_when', 'disabled_when', 'reveals']) if (el[k] !== undefined) conditions[k] = el[k];
    for (const k of COPY_PROPS) if (typeof el[k] === 'string') copy.push({ element: el.id, prop: k, text: el[k] });
    for (const k of COPY_LISTS)
      if (Array.isArray(el[k])) el[k].forEach((item, i) => {
        if (typeof item === 'string') copy.push({ element: el.id, prop: `${k}[${i}]`, text: item });
        else if (item && typeof item.label === 'string' && !item.kind) copy.push({ element: el.id, prop: `${k}[${i}].label`, text: item.label });
      });
    if (Array.isArray(el.columns)) el.columns.forEach((col, i) => typeof col?.label === 'string' && copy.push({ element: el.id, prop: `columns[${i}].label`, text: col.label }));
    elements.push({
      id: el.id,
      kind: el.kind,
      path: key,
      line: screen.lineOf(path),
      parent,
      props,
      conditions,
      component: contract ? { file: contract.file ? relative(project.dir, contract.file) : null, maps_to: contract.maps_to ?? {} } : null,
      code: codeOf(contract, el),
      layout: doc.layout?.[el.id] ?? null,
    });
  }

  const required = conventions.states?.required?.[doc.type] ?? [];
  const patchesOf = (list) => (Array.isArray(list) ? list : []).map((p) => ({ target: p.target, change: describeChange(D, p), patch: p }));
  const states = Object.entries(doc.states ?? {}).map(([name, list]) => ({ name, required: required.includes(name), changes: patchesOf(list) }));
  const variants = Object.entries(doc.variants ?? {}).map(([axis, options]) => ({ axis, options: Object.entries(options ?? {}).map(([name, list]) => ({ name, changes: patchesOf(list) })) }));
  const bpTable = conventions.breakpoints ?? {};
  const breakpoints = Object.entries(doc.breakpoints ?? {}).map(([name, list]) => ({ name, width: bpTable[name] ?? null, changes: patchesOf(list) }));
  const flows = (doc.flows ?? []).map((f) => ({ from: f.from, via: f.via ?? null, gesture: f.gesture ?? null, nav: f.nav ?? null, to: f.to, when: f.when ?? null, style: f.style ?? 'default' }));

  // tokens: what the layout names, and what the contracts of the kinds on this screen bind
  const used = new Map();
  const note = (name, at) => {
    if (!hasToken(merged, name)) return;
    if (!used.has(name)) used.set(name, new Set());
    used.get(name).add(at);
  };
  const layoutRefs = (rule, at) => {
    for (const k of ['gap', 'padding']) if (typeof rule?.[k] === 'string') note(rule[k], `${at}.${k}`);
  };
  for (const [key, rule] of Object.entries(doc.layout ?? {})) layoutRefs(rule, `layout.${key}`);
  for (const s of states) for (const c of s.changes) if (c.patch.layout) layoutRefs(c.patch.layout, `states.${s.name}.${c.target}`);
  for (const b of breakpoints) for (const c of b.changes) if (c.patch.layout) layoutRefs(c.patch.layout, `breakpoints.${b.name}.${c.target}`);
  const kinds = new Map();
  for (const e of elements) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1);
  for (const kind of kinds.keys()) {
    const c = registry[kind];
    if (c) for (const { path, token } of bindingsOf(c)) note(token, `${kind}.${path.join('.')}`);
  }
  const tokens = [...used.entries()].map(([name, at]) => ({ name, css: `--${name.replace(/\./g, '-')}`, value: getToken(merged, name), usedAt: [...at] }));

  const components = [...kinds.entries()].map(([kind, count]) => {
    const c = registry[kind];
    return { kind, count, file: c?.file ? relative(project.dir, c.file) : null, maps_to: c?.maps_to ?? {}, props: Object.keys(c?.props ?? {}) };
  });
  const assets = assetRefs(project)
    .filter((r) => r.screen === doc.screen)
    .map((r) => ({ path: r.path, at: r.at.join('.') }));
  const tbd = [...walkTbd(doc)].map(({ path, meta }) => ({ path: path.join('.'), owner: meta.owner ?? null, due: meta.due ?? null, note: meta.note ?? null }));

  // acceptance: one line per thing the file promises, written in the project's language
  const acceptance = [];
  if (required.length) acceptance.push({ text: fmt(D.accRequired, { states: required.join(', ') }), source: 'type' });
  for (const s of states) for (const c of s.changes) acceptance.push({ text: fmt(D.accState, { state: s.name, target: c.target, change: c.change }), source: `states.${s.name}` });
  for (const v of variants) for (const o of v.options) for (const c of o.changes) acceptance.push({ text: fmt(D.accState, { state: `${v.axis}=${o.name}`, target: c.target, change: c.change }), source: `variants.${v.axis}.${o.name}` });
  for (const e of elements) {
    if (e.conditions.show_when) acceptance.push({ text: fmt(D.accCond, { id: e.id, cond: fmt(D.condShow, { v: short(e.conditions.show_when) }) }), source: `${e.path}.show_when` });
    if (e.conditions.disabled_when) acceptance.push({ text: fmt(D.accCond, { id: e.id, cond: fmt(D.condDisabled, { v: short(e.conditions.disabled_when) }) }), source: `${e.path}.disabled_when` });
    if (e.conditions.reveals) acceptance.push({ text: fmt(D.accCond, { id: e.id, cond: fmt(D.condReveals, { v: Object.keys(e.conditions.reveals).join(', ') }) }), source: `${e.path}.reveals` });
  }
  flows.forEach((f, i) => acceptance.push({ text: fmt(D.accFlow, { from: f.via ? `${f.from}.${f.via}` : f.from, gesture: f.gesture ?? '', to: f.to + (f.nav ? ` (${f.nav})` : ''), when: f.when ? ` — ${f.when}` : '' }).replace(/\s+/g, ' '), source: `flows.${i}` }));
  for (const b of breakpoints) for (const c of b.changes) acceptance.push({ text: fmt(D.accBp, { bp: b.name, width: b.width ?? '?', target: c.target, change: c.change }), source: `breakpoints.${b.name}` });

  return {
    screen: doc.screen,
    id: doc.id,
    file: relative(project.dir, screen.file),
    section: doc.section,
    type: doc.type,
    platform: doc.platform ?? conventions.platforms?.default ?? 'web',
    status: doc.status ?? 'draft',
    refs: doc.refs ?? {},
    notes: doc.notes ?? [],
    elements,
    copy,
    layout: doc.layout ?? {},
    states,
    variants,
    breakpoints,
    flows,
    tokens,
    components,
    assets,
    tbd,
    acceptance,
    lint: { ...summarize(findings), findings },
  };
}

// The same spec as Markdown — what a developer pastes into a ticket, what an agent reads when
// it wants prose rather than JSON.
export function specMarkdown(spec, lang = 'en') {
  const D = dictionary(lang);
  const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const table = (head, rows) => (rows.length ? [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n') : `_${D.noneYet}_`);
  const out = [];
  out.push(`# ${spec.screen} — ${D.specFor}`, '', `${spec.section} · ${spec.type} · ${spec.platform} · ${D.statusLabel}: ${spec.status}${spec.file ? ` · ${spec.file}` : ''}`, '');
  if (Object.keys(spec.refs).length) out.push(Object.entries(spec.refs).map(([k, v]) => `- ${k}: ${v}`).join('\n'), '');
  out.push(`## ${D.acceptance}`, '', spec.acceptance.length ? spec.acceptance.map((a) => `- [ ] ${a.text}`).join('\n') : `_${D.noneYet}_`, '');
  out.push(`## ${D.elementsLabel}`, '', table(['id', 'kind', D.codeLabel, 'props', 'path'], spec.elements.map((e) => [e.id, e.kind, e.code ? e.code.snippet : e.component?.maps_to ? Object.entries(e.component.maps_to).filter(([k]) => k !== 'code').map(([k, v]) => `${k}/${v}`).join(', ') : '', Object.entries(e.props).map(([k, v]) => `${k}: ${short(v)}`).join('; '), `${e.path}${e.line ? `:${e.line}` : ''}`])), '');
  out.push(`## ${D.states}`, '', ...spec.states.map((s) => `- **${s.name}**${s.required ? ' *' : ''}: ${s.changes.map((c) => `${c.target} ${c.change}`).join('; ') || D.noneYet}`), '');
  if (spec.variants.length) out.push(`## ${D.variants}`, '', ...spec.variants.flatMap((v) => v.options.map((o) => `- **${v.axis} = ${o.name}**: ${o.changes.map((c) => `${c.target} ${c.change}`).join('; ') || D.noneYet}`)), '');
  if (spec.breakpoints.length) out.push(`## ${D.breakpointsLabel}`, '', ...spec.breakpoints.map((b) => `- **${b.name}** (${b.width ?? '?'}px): ${b.changes.map((c) => `${c.target} ${c.change}`).join('; ') || D.noneYet}`), '');
  out.push(`## ${D.flows}`, '', table(['from', 'gesture', 'nav', 'to', 'when'], spec.flows.map((f) => [f.via ? `${f.from}.${f.via}` : f.from, f.gesture ?? '', f.nav ?? '', f.to, f.when ?? ''])), '');
  out.push(`## ${D.copyLabel}`, '', table(['element', 'prop', 'text'], spec.copy.map((c) => [c.element, c.prop, c.text])), '');
  out.push(`## ${D.tokensUsed}`, '', table(['token', 'css', 'value', D.usedAt], spec.tokens.map((t) => [t.name, `var(${t.css})`, t.value, t.usedAt.join(', ')])), '');
  out.push(`## ${D.components}`, '', table(['kind', 'n', 'maps_to', 'file'], spec.components.map((c) => [c.kind, c.count, Object.entries(c.maps_to).map(([k, v]) => `${k}: ${typeof v === 'object' ? `${v.import ?? ''} ${v.name ?? ''}`.trim() : v}`).join(', '), c.file ?? ''])), '');
  if (spec.assets.length) out.push(`## ${D.assets}`, '', ...spec.assets.map((a) => `- ${a.path} — ${a.at}`), '');
  out.push(`## ${D.openQuestions}`, '', spec.tbd.length ? spec.tbd.map((t) => `- ${t.path}${t.owner ? ` (${t.owner}${t.due ? `, ${t.due}` : ''})` : ''}${t.note ? ` — ${t.note}` : ''}`).join('\n') : `_${D.noneYet}_`, '');
  if (spec.notes.length) out.push(`## ${D.notes}`, '', ...spec.notes.map((n) => `- ${typeof n === 'string' ? n : short(n)}`), '');
  out.push(`## lint`, '', `${spec.lint.blocking} ${D.blocking}, ${spec.lint.warning} ${D.warning}`, '');
  return out.join('\n');
}
