import { mergeState } from '../merge.js';
import { walkElements } from '../elements.js';
import { lint, summarize } from '../lint.js';
import { resolveFlowTarget } from '../flows.js';
import { kinds, h, v, isTbd } from './kinds.js';
import { DEFAULT_TOKENS, mergeTokens, tokenVar, tokensToCss } from './tokens.js';
import { CSS, INSPECTOR_JS } from './page.js';
import { parseScreenText } from '../project.js';

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

export function renderIndex(project, { branch = null, today, proposals = [] } = {}) {
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
${proposals.length ? `<h2 class="row-title">Waiting for a person</h2><table class="index"><thead><tr><th>proposal</th><th>screen</th><th>tier</th><th>summary</th><th>lint after</th></tr></thead><tbody>${proposals
  .map((p) => `<tr><td><a href="proposal-${h(p.id)}.html">${h(p.id)}</a></td><td>${h(p.screen)}</td><td>${h(p.tier)}</td><td>${h(p.summary)}</td><td class="${p.lint?.after?.blocking ? 'bad' : ''}">${p.lint?.after?.blocking ?? 0} blocking, ${p.lint?.after?.warning ?? 0} warning</td></tr>`)
  .join('')}</tbody></table>` : ''}
</body></html>`;
}

// A pending proposal drawn as a decision page: what was agreed, what changes, and every
// state AS-IS beside TO-BE. This is the sketch step of DESIGN.md §7 — nothing is written
// until a person has seen the screen it would produce.
export function renderProposal(project, proposal, { branch = null } = {}) {
  const tokens = mergeTokens(DEFAULT_TOKENS, project.tokens);
  const maps = mapsFor(project);
  const before = parseScreenText(proposal.before, proposal.file);
  const after = parseScreenText(proposal.after, proposal.file);
  const known = project.conventions.states?.known ?? [];
  const present = [...new Set([...Object.keys(before.doc.states ?? {}), ...Object.keys(after.doc.states ?? {})])];
  const states = ['Default', ...known.filter((k) => k !== 'Default' && present.includes(k)), ...present.filter((k) => !known.includes(k))];

  const pair = (state) => {
    const a = before.doc.states?.[state] || state === 'Default' ? renderView(project, before, mergeState(before.doc, state), maps) : '<div class="hint">not in AS-IS</div>';
    const b = after.doc.states?.[state] || state === 'Default' ? renderView(project, after, mergeState(after.doc, state), maps) : '<div class="hint">removed in TO-BE</div>';
    return `<h2 class="row-title">${h(state)}</h2><div class="states"><section class="state" id="asis-${h(state)}"><h3>AS-IS</h3>${a}</section><section class="state" id="tobe-${h(state)}"><h3>TO-BE</h3>${b}</section></div>`;
  };

  const decisions = (proposal.decisions ?? []).length
    ? `<table class="index"><thead><tr><th>item</th><th>decision</th><th>why</th></tr></thead><tbody>${proposal.decisions.map((d) => `<tr><td>${h(d.item)}</td><td>${h(d.decision)}</td><td>${h(d.why ?? '')}</td></tr>`).join('')}</tbody></table>`
    : '<div class="hint" style="margin:0 var(--space-lg)">no decisions recorded — the agent proposed without the interview</div>';
  const cell = (x) => (x === undefined ? '' : `<code>${h(JSON.stringify(x))}</code>`);
  const rows = [
    ...proposal.diff.changed.map((e) => [e.path.join('.'), e.before, e.after]),
    ...proposal.diff.added.map((e) => [e.path.join('.'), undefined, e.after]),
    ...proposal.diff.removed.map((e) => [e.path.join('.'), e.before, undefined]),
  ];
  const diff = `<table class="index"><thead><tr><th>where</th><th>AS-IS</th><th>TO-BE</th></tr></thead><tbody>${rows.map(([w, a, b]) => `<tr><td>${h(w)}</td><td>${cell(a)}</td><td>${cell(b)}</td></tr>`).join('')}</tbody></table>`;
  const lintLine = `lint ${proposal.lint.before.blocking}→${proposal.lint.after.blocking} blocking, ${proposal.lint.before.warning}→${proposal.lint.after.warning} warning`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>proposal ${h(proposal.id)}</title>
<style>${tokensToCss(tokens)}\n${CSS}</style></head>
<body data-file="${h(proposal.file)}">
<header class="top"><a href="index.html">← screens</a><h1>${h(proposal.screen)} · proposal</h1><span class="meta">${h(proposal.status)} · tier ${h(proposal.tier)} · ${h(lintLine)}${branch ? ` · ${h(branch)}` : ''}</span><label class="dev-toggle"><input type="checkbox" id="dev"> developer</label></header>
<p style="margin:var(--space-md) var(--space-lg);font-size:15px">${h(proposal.summary || '(no summary)')}</p>
<h2 class="row-title">Decided before this version</h2>${decisions}
<h2 class="row-title">What changes</h2>${diff}
<p class="hint" style="margin:0 var(--space-lg)">to accept: <code>design-core apply &lt;project&gt; ${h(proposal.id)} --by &lt;you&gt;</code> · to decline: <code>design-core reject &lt;project&gt; ${h(proposal.id)} --reason "…"</code></p>
${states.map(pair).join('')}
<aside id="inspector" class="inspector"><div class="hint">Click an element to inspect it.</div></aside>
<script>${INSPECTOR_JS}</script>
</body></html>`;
}
