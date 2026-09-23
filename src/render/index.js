import { mergeState } from '../merge.js';
import { walkElements } from '../elements.js';
import { lint, summarize } from '../lint.js';
import { resolveFlowTarget } from '../flows.js';
import { kinds, h, v, isTbd } from './kinds.js';
import { DEFAULT_TOKENS, mergeTokens, tokenVar, tokensToCss } from './tokens.js';
import { CSS, INSPECTOR_JS } from './page.js';

// render draws a screen file with the bundled component set (or, later, the team's own),
// every state side by side, every variant axis in its own row. It is the product surface
// (DESIGN.md §6): what a reviewer opens, what a developer inspects, what a comment anchors to.
//
// Finite by rule: the states row renders each state with no variant chosen; each variants
// row renders every option of one axis in the Default state. No cross product.

const ALIGN = { start: 'flex-start', end: 'flex-end', center: 'center', 'space-between': 'space-between', stretch: 'stretch' };

function layoutStyle(rule) {
  if (!rule) return '';
  const s = [];
  if (rule.kind === 'stack') s.push('display:flex', `flex-direction:${rule.direction ?? 'column'}`);
  if (rule.kind === 'row') s.push('display:flex', 'flex-direction:row', 'align-items:center');
  if (rule.kind === 'grid' || rule.kind === 'columns') s.push('display:grid', `grid-template-columns:repeat(${rule.columns ?? 2},minmax(0,1fr))`);
  if (rule.gap) s.push(`gap:${tokenVar(rule.gap)}`);
  if (rule.padding) s.push(`padding:${tokenVar(rule.padding)}`);
  if (rule.align) s.push(`justify-content:${ALIGN[rule.align] ?? rule.align}`, rule.kind ? '' : 'display:flex');
  if (rule.grow) s.push('flex:1 1 auto');
  if (rule.size) s.push(`width:var(--size-${rule.size})`);
  return s.filter(Boolean).join(';');
}

function conditionBadges(el) {
  const out = [];
  if (el.show_when) out.push(`<span class="cond">shown when: ${v(el.show_when)}</span>`);
  if (el.disabled_when) out.push(`<span class="cond">disabled when: ${v(el.disabled_when)}</span>`);
  return out.join('');
}

function makeRenderer(screen, layout, maps) {
  const lines = new Map();
  for (const { el, path } of walkElements(screen.doc.elements ?? [], ['elements'])) lines.set(el.id, { path: path.join('.'), line: screen.lineOf(path) });

  const r = {
    element(el, path = null) {
      const fn = kinds[el.kind] ?? kinds.generic;
      const known = lines.get(el.id);
      const style = layoutStyle(layout[el.id]);
      const propsJson = h(JSON.stringify(Object.fromEntries(Object.entries(el).filter(([k]) => !['children'].includes(k)))));
      const cls = ['el', `el-${el.kind}`, kinds[el.kind] ? '' : 'el-unknown', el.disabled_when ? 'is-disabled' : ''].filter(Boolean).join(' ');
      return `<div class="${cls}" data-id="${h(el.id)}" data-kind="${h(el.kind)}" data-path="${h(known?.path ?? path ?? '')}" data-line="${known?.line ?? ''}" data-maps="${h(maps[el.kind] ?? '')}" data-props="${propsJson}"${style ? ` style="${style}"` : ''}>${conditionBadges(el)}${fn(el, r)}</div>`;
    },
    children(el) {
      return (el.children ?? []).map((c) => r.element(c)).join('');
    },
  };
  return r;
}

function renderView(project, screen, view, maps) {
  const r = makeRenderer(screen, view.layout, maps);
  const body = view.elements.map((el) => r.element(el)).join('');
  const root = layoutStyle(view.layout.root);
  const inner = `<div class="view-root" style="${root}">${body}</div>`;
  return screen.doc.type === 'modal' ? `<div class="backdrop"><div class="modal-box">${inner}</div></div>` : inner;
}

function mapsFor(project) {
  const out = {};
  for (const [kind, def] of Object.entries(project.conventions.kinds ?? {})) {
    const m = def?.maps_to;
    if (m && typeof m === 'object') out[kind] = Object.entries(m).map(([ds, name]) => `${ds}/${name}`).join(', ');
  }
  return out;
}

function stateOrder(project, screen) {
  const known = project.conventions.states?.known ?? [];
  const present = Object.keys(screen.doc.states ?? {});
  return ['Default', ...known.filter((s) => s !== 'Default' && present.includes(s)), ...present.filter((s) => !known.includes(s))];
}

function flowLink(project, screen, flow) {
  const target = resolveFlowTarget(flow.to, project.screens);
  if (!target) return `<span class="dead">${h(flow.to)}</span>`;
  const same = target.screen === screen.doc.screen;
  const href = `${same ? '' : `${target.screen}.html`}${target.state ? `#state-${target.state}` : ''}` || `${target.screen}.html`;
  return `<a href="${h(href)}">${h(flow.to)}</a>`;
}

export function renderScreen(project, screen, { branch = null } = {}) {
  const doc = screen.doc;
  const tokens = mergeTokens(DEFAULT_TOKENS, project.tokens);
  const maps = mapsFor(project);

  const states = stateOrder(project, screen)
    .map((state) => {
      const view = mergeState(doc, state);
      return `<section class="state" id="state-${h(state)}"><h3>${h(state)}</h3>${renderView(project, screen, view, maps)}</section>`;
    })
    .join('');

  const variants = Object.entries(doc.variants ?? {})
    .map(([axis, options]) => {
      const cols = Object.keys(options ?? {})
        .map((opt) => {
          const view = mergeState(doc, 'Default', { [axis]: opt });
          return `<section class="state" id="variant-${h(axis)}-${h(opt)}"><h3>${h(opt)}</h3>${renderView(project, screen, view, maps)}</section>`;
        })
        .join('');
      return `<h2 class="row-title">Variant · ${h(axis)} <span class="hint">each option in Default</span></h2><div class="states">${cols}</div>`;
    })
    .join('');

  const flows = (doc.flows ?? [])
    .map((f) => `<li><code>${h(f.from)}${f.via ? `.${h(f.via)}` : ''}</code> → ${flowLink(project, screen, f)}${f.when ? ` <span class="hint">when ${v(f.when)}</span>` : ''}${f.style === 'conditional' ? ' <span class="cond">conditional</span>' : ''}</li>`)
    .join('');
  const notes = (doc.notes ?? []).map((n) => `<li>${v(n)}</li>`).join('');
  const refs = Object.entries(doc.refs ?? {}).map(([k, u]) => `<span class="ref"><b>${h(k)}</b> ${h(u)}</span>`).join(' ');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${h(doc.screen)}</title>
<style>${tokensToCss(tokens)}\n${CSS}</style></head>
<body data-file="${h(screen.file)}">
<header class="top"><a href="index.html">← screens</a><h1>${h(doc.screen)}</h1><span class="meta">${h(doc.section)} · ${h(doc.type)}${branch ? ` · ${h(branch)}` : ''}</span><label class="dev-toggle"><input type="checkbox" id="dev"> developer</label></header>
<div class="refs">${refs}</div>
<h2 class="row-title">States <span class="hint">no variant chosen</span></h2>
<div class="states">${states}</div>
${variants}
<h2 class="row-title">Flows</h2><ul class="flows">${flows || '<li class="hint">none</li>'}</ul>
<h2 class="row-title">Notes</h2><ul class="notes">${notes || '<li class="hint">none</li>'}</ul>
<aside id="inspector" class="inspector"><div class="hint">Click an element to inspect it.</div></aside>
<script>${INSPECTOR_JS}</script>
</body></html>`;
}

export function renderIndex(project, { branch = null, today } = {}) {
  const findings = lint(project, { branch, today });
  const tokens = mergeTokens(DEFAULT_TOKENS, project.tokens);
  const rows = project.screens
    .map((s) => {
      const mine = findings.filter((f) => f.file === s.file);
      const sum = summarize(mine);
      const tbd = mine.filter((f) => f.id === 'L08').length;
      return `<tr><td><a href="${h(s.doc.screen)}.html">${h(s.doc.screen)}</a></td><td>${h(s.doc.section)}</td><td>${h(s.doc.type)}</td><td>${Object.keys(s.doc.states ?? {}).length}</td><td class="${sum.blocking ? 'bad' : ''}">${sum.blocking}</td><td>${sum.warning}</td><td>${tbd ? `<span class="tbd">$tbd × ${tbd}</span>` : ''}</td></tr>`;
    })
    .join('');
  const total = summarize(findings);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>screens</title><style>${tokensToCss(tokens)}\n${CSS}</style></head>
<body><header class="top"><h1>Screens</h1><span class="meta">${project.screens.length} screens${branch ? ` on ${h(branch)}` : ''} — ${total.blocking} blocking, ${total.warning} warning</span></header>
<table class="index"><thead><tr><th>screen</th><th>section</th><th>type</th><th>states</th><th>blocking</th><th>warning</th><th>$tbd</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
}
