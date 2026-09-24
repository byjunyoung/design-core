import { mergeState } from '../merge.js';
import { walkElements } from '../elements.js';
import { lint, summarize } from '../lint.js';
import { resolveFlowTarget } from '../flows.js';
import { kinds, h, v, isTbd, setLanguage } from './kinds.js';
import { dictionary, languageOf, pageStrings } from './i18n.js';
import { DEFAULT_TOKENS, mergeTokens, tokenVar, tokensToCss } from './tokens.js';
import { CSS, INSPECTOR_JS } from './page.js';
import { parseScreenText } from '../project.js';

// render draws a screen file with the bundled component set or the team's own. It is the
// product surface (DESIGN.md §6): what a reviewer opens, what a developer inspects, what a
// comment anchors to. The shell is sidebar · main · drawer; states are tabs, or side by side
// when "compare" is on; meta information is a dot on the picture and text in the drawer.
//
// Finite by rule: the states tabs render each state with no variant chosen; each variant
// axis renders every option in the Default state. No cross product.

const ALIGN = { start: 'flex-start', end: 'flex-end', center: 'center', 'space-between': 'space-between', stretch: 'stretch' };

// A layout rule's container part (stack/grid) applies only to elements that hold children;
// a leaf kind (a table, a tile grid) draws its own inside and only takes gap/padding/size.
function layoutStyle(rule, { container = true } = {}) {
  if (!rule) return '';
  const s = [];
  if (container) {
    if (rule.kind === 'stack') s.push('display:flex', `flex-direction:${rule.direction ?? 'column'}`);
    if (rule.kind === 'row') s.push('display:flex', 'flex-direction:row', 'align-items:center');
    if (rule.kind === 'grid' || rule.kind === 'columns') s.push('display:grid', `grid-template-columns:repeat(${rule.columns ?? 2},minmax(0,1fr))`);
    if (rule.gap) s.push(`gap:${tokenVar(rule.gap)}`);
    if (rule.align) s.push(`justify-content:${ALIGN[rule.align] ?? rule.align}`, rule.kind ? '' : 'display:flex');
  }
  if (rule.padding) s.push(`padding:${tokenVar(rule.padding)}`);
  if (rule.grow) s.push('flex:1 1 auto');
  if (rule.size) s.push(`width:var(--size-${rule.size})`);
  return s.filter(Boolean).join(';');
}

// Meta information stays off the picture: a dot per fact, the fact itself in the title and
// in the drawer. Grey = a condition, yellow = an undecided value somewhere in the element.
function dots(el) {
  const out = [];
  if (el.show_when) out.push(`<i class="dot cond" title="shown when: ${h(el.show_when)}"></i>`);
  if (el.disabled_when) out.push(`<i class="dot cond" title="disabled when: ${h(el.disabled_when)}"></i>`);
  if (el.reveals) out.push(`<i class="dot cond" title="reveals: ${h(Object.keys(el.reveals).join(', '))}"></i>`);
  if (JSON.stringify(Object.fromEntries(Object.entries(el).filter(([k]) => k !== 'children'))).includes('"$tbd"')) out.push(`<i class="dot tbd" title="an undecided value ($tbd)"></i>`);
  return out.length ? `<span class="dots">${out.join('')}</span>` : '';
}

function makeRenderer(screen, layout, maps, adapter = null) {
  const lines = new Map();
  for (const { el, path } of walkElements(screen.doc.elements ?? [], ['elements'])) lines.set(el.id, { path: path.join('.'), line: screen.lineOf(path) });

  const r = {
    element(el, path = null) {
      const fn = adapter?.kinds?.[el.kind] ?? kinds[el.kind] ?? kinds.generic;
      const known = lines.get(el.id);
      const style = layoutStyle(layout[el.id], { container: !!el.children?.length });
      const propsJson = h(JSON.stringify(Object.fromEntries(Object.entries(el).filter(([k]) => !['children'].includes(k)))));
      const cls = ['el', `el-${el.kind}`, kinds[el.kind] ? '' : 'el-unknown', el.disabled_when ? 'is-disabled' : ''].filter(Boolean).join(' ');
      // `repeat: N` (what an import writes for a run of identical instances) draws the element N times in a row.
      const once = fn(el, r);
      const inner = el.repeat > 1 ? `<div class="repeat">${Array.from({ length: Math.min(Number(el.repeat), 200) }, () => `<div class="rep">${once}</div>`).join('')}</div>` : once;
      return `<div class="${cls}" data-id="${h(el.id)}" data-kind="${h(el.kind)}" data-path="${h(known?.path ?? path ?? '')}" data-line="${known?.line ?? ''}" data-maps="${h(maps[el.kind] ?? '')}" data-props="${propsJson}"${style ? ` style="${style}"` : ''}>${dots(el)}${inner}</div>`;
    },
    children(el) {
      return (el.children ?? []).map((c) => r.element(c)).join('');
    },
  };
  return r;
}

// One drawn view of a screen: a stage (what the page gives it) holding a frame at the
// reference width; the page scales the frame to fit.
// Which platform a screen is drawn as: the screen's own `platform`, else the project default.
const DEFAULT_PLATFORMS = {
  web: { width: 1280, frame: 'none' },
  ios: { width: 390, height: 844, frame: 'phone' },
  android: { width: 412, height: 915, frame: 'phone' },
  tablet: { width: 1024, height: 768, frame: 'tablet' },
  kiosk: { width: 1080, height: 1920, frame: 'kiosk' },
};
export function platformOf(project, screen) {
  const table = { ...DEFAULT_PLATFORMS, ...(project.conventions.platforms ?? {}) };
  const name = screen.doc.platform ?? table.default ?? 'web';
  const spec = table[name] ?? DEFAULT_PLATFORMS.web;
  return { name, width: spec.width ?? 1280, height: spec.height ?? null, frame: spec.frame ?? 'none' };
}

function renderView(project, screen, view, maps, adapter = null) {
  const r = makeRenderer(screen, view.layout, maps, adapter);
  const body = view.elements.map((el) => r.element(el)).join('');
  const root = layoutStyle(view.layout.root);
  const inner = `<div class="view-root" style="${root}">${body}</div>`;
  const platform = platformOf(project, screen);
  const content = screen.doc.type === 'modal' ? `<div class="backdrop"><div class="modal-box">${inner}</div></div>` : inner;
  const device = platform.frame && platform.frame !== 'none';
  const chrome = platform.frame === 'phone' ? { top: `<div class="status-bar"><span>9:41</span><span class="notch"></span><span>●●●</span></div>`, bottom: `<div class="home-indicator"><span></span></div>` } : { top: '', bottom: '' };
  const style = `--ref-w:${platform.width}px${platform.height ? `;--ref-h:${platform.height}px` : ''}`;
  return `<div class="stage${device ? ' stage-device' : ''}"><div class="frame device-${h(platform.frame === 'none' ? 'web' : platform.frame)}" style="${style}">${chrome.top}${content}${chrome.bottom}</div></div>`;
}

function mapsFor(project) {
  const out = {};
  for (const [kind, def] of Object.entries(project.conventions.kinds ?? {})) {
    const m = def?.maps_to;
    if (m && typeof m === 'object') out[kind] = Object.entries(m).filter(([ds]) => ds !== 'figma').map(([ds, name]) => `${ds}/${[].concat(name).join('|')}`).join(', ');
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
  return `<a href="${h(href)}"><u>${h(flow.to)}</u></a>`;
}

// The sidebar every page shares: sections → screens, each with what a reviewer wants to
// know before opening it — blocking findings, undecided values, open comments.
function sidebar(project, { current = null, findings = null, comments = [], proposals = [] } = {}) {
  const D = dictionary(languageOf(project));
  const found = findings ?? lint(project, { branch: null });
  const bySection = {};
  for (const s of project.screens) (bySection[s.doc.section] ??= []).push(s);
  const order = [...project.sections.filter((x) => bySection[x]), ...Object.keys(bySection).filter((x) => !project.sections.includes(x))];
  const links = order
    .map((section) => {
      const items = bySection[section]
        .map((s) => {
          const mine = found.filter((f) => f.file === s.file);
          const block = mine.filter((f) => f.severity === 'blocking').length;
          const tbd = mine.filter((f) => f.id === 'L08').length;
          const open = comments.filter((c) => c.screen === s.doc.screen).length;
          const pills = [block ? `<span class="pill block">${block}</span>` : '', tbd ? `<span class="pill tbd">${tbd}</span>` : '', open ? `<span class="pill cm">${open}</span>` : ''].join('');
          return `<a class="side-link${current === s.doc.screen ? ' current' : ''}" href="${h(s.doc.screen)}.html"><span class="name">${h(s.doc.screen)}</span>${pills}</a>`;
        })
        .join('');
      return `<div class="sec">${h(section)}</div>${items}`;
    })
    .join('');
  const foot = `<div class="foot"><a class="side-link${current === null ? ' current' : ''}" href="index.html"><span class="name">${D.overview}</span>${proposals.length ? `<span class="pill cm">${proposals.length} ${D.waiting}</span>` : ''}</a></div>`;
  return `<nav class="side"><div class="brand">${D.screens} <span class="hint">${project.screens.length}</span></div>${links}${foot}</nav>`;
}

function page({ title, tokens, extraCss = '', file = '', body, api = false, screen = '', comments = [], lang = 'en' }) {
  return `<!doctype html>
<html lang="${h(lang)}"><head><meta charset="utf-8"><title>${h(title)}</title>
<style>${tokensToCss(tokens)}\n${CSS}</style>${extraCss}</head>
<body data-file="${h(file)}">
${body}
<script>window.DOAN_API = ${api ? 'true' : 'false'}; window.DOAN_SCREEN = ${JSON.stringify(screen)}; window.DOAN_COMMENTS = ${JSON.stringify(comments.map((c) => ({ id: c.id, path: c.path, author: c.author, text: c.text })))}; window.DOAN_I18N = ${JSON.stringify(pageStrings(lang))};</script>
<script>${INSPECTOR_JS}</script>
</body></html>`;
}

export function renderScreen(project, screen, { branch = null, adapter = null, api = false, comments = [] } = {}) {
  const doc = screen.doc;
  const lang = languageOf(project);
  const D = dictionary(lang);
  setLanguage(lang);
  const tokens = mergeTokens(DEFAULT_TOKENS, project.tokens);
  const maps = mapsFor(project);
  const findings = lint(project, { branch });

  const order = stateOrder(project, screen);
  const stateTabs = order.map((state, i) => `<button class="tab${i === 0 ? ' active' : ''}" data-state="${h(state)}" data-target="state-${h(state)}">${h(state)}${state !== 'Default' ? `<span class="n">${(doc.states?.[state] ?? []).length}</span>` : ''}</button>`).join('');
  const variantTabs = Object.entries(doc.variants ?? {})
    .map(([axis, options]) => `<span class="axis">${h(axis)}</span>${Object.keys(options ?? {}).map((opt) => `<button class="tab" data-state="${h(axis)}=${h(opt)}" data-target="variant-${h(axis)}-${h(opt)}">${h(opt)}</button>`).join('')}`)
    .join('');
  const statePanels = order
    .map((state, i) => `<section class="state${i === 0 ? ' active' : ''}" id="state-${h(state)}"><h3>${h(state)}</h3>${renderView(project, screen, mergeState(doc, state), maps, adapter)}</section>`)
    .join('');
  const variantPanels = Object.entries(doc.variants ?? {})
    .map(([axis, options]) => Object.keys(options ?? {}).map((opt) => `<section class="state" id="variant-${h(axis)}-${h(opt)}"><h3>${h(axis)} · ${h(opt)}</h3>${renderView(project, screen, mergeState(doc, 'Default', { [axis]: opt }), maps, adapter)}</section>`).join(''))
    .join('');

  const flows = (doc.flows ?? [])
    .map((f) => `<li><code>${h(f.from)}${f.via ? `.${h(f.via)}` : ''}</code>${f.gesture ? ` <span class="gesture gesture-${h(f.gesture)}">${h(f.gesture)}</span>` : ''} → ${flowLink(project, screen, f)}${f.nav ? ` <span class="navkind nav-${h(f.nav)}">${h(f.nav)}</span>` : ''}${f.when ? ` <span class="hint">when ${v(f.when)}</span>` : ''}${f.style === 'conditional' ? ' <span class="hint">(conditional)</span>' : ''}</li>`)
    .join('');
  const notes = (doc.notes ?? []).map((n) => `<li>${v(n)}</li>`).join('');
  const refs = Object.entries(doc.refs ?? {}).map(([k, u]) => `<span><span class="hint">${h(k)}</span> <code>${h(u)}</code></span>`).join(' · ');
  const commentList = comments.map((c) => `<li data-comment="${h(c.id)}"><b>${h(c.author)}</b> on <code>${h(c.path)}</code>: ${h(c.text)}</li>`).join('');

  const body = `<div class="shell">
${sidebar(project, { current: doc.screen, findings, comments: api ? comments : [], proposals: [] })}
<main class="main">
<header class="top"><h1>${h(doc.screen)}</h1><span class="meta">${h(doc.section)} · ${h(doc.type)} · ${h(platformOf(project, screen).name)}${adapter ? ` · ${h(adapter.name)} ${D.components}` : ''}${branch ? ` · ${h(branch)}` : ''}</span><span class="spacer"></span><label class="toggle"><input type="checkbox" id="compare"> ${D.compare}</label><label class="toggle"><input type="checkbox" id="dev"> ${D.paths}</label></header>
<div class="tabs-row">${stateTabs}${variantTabs ? `<span class="axis" style="margin-left:var(--space-md)">${D.variants}</span>${variantTabs}` : ''}</div>
<div class="states">${statePanels}${variantPanels}</div>
<div class="section-title">${D.flows}</div><ul class="list">${flows || `<li class="hint">${D.none}</li>`}</ul>
<div class="section-title">${D.notes}</div><ul class="list">${notes || `<li class="hint">${D.none}</li>`}</ul>
<div class="section-title">${D.comments} <span class="hint">${comments.length} ${D.open}</span></div><ul class="list" id="comments">${commentList || `<li class="hint">${D.none}</li>`}</ul>
${refs ? `<div class="section-title">${D.references}</div><div class="hint" style="font-size:12px">${refs}</div>` : ''}
</main>
<aside id="inspector" class="drawer"></aside>
</div>`;
  return page({ title: doc.screen, tokens, extraCss: adapter?.styles ? adapter.styles() : '', file: screen.file, body, api, screen: doc.screen, comments, lang });
}

export function renderIndex(project, { branch = null, today, proposals = [], comments = [], api = false } = {}) {
  const lang = languageOf(project);
  const D = dictionary(lang);
  setLanguage(lang);
  const findings = lint(project, { branch, today });
  const tokens = mergeTokens(DEFAULT_TOKENS, project.tokens);
  const total = summarize(findings);
  const bySection = {};
  for (const s of project.screens) (bySection[s.doc.section] ??= []).push(s);
  const order = [...project.sections.filter((x) => bySection[x]), ...Object.keys(bySection).filter((x) => !project.sections.includes(x))];
  const cards = order
    .map((section) => {
      const items = bySection[section]
        .map((s) => {
          const mine = findings.filter((f) => f.file === s.file);
          const sum = summarize(mine);
          const tbd = mine.filter((f) => f.id === 'L08').length;
          const open = comments.filter((c) => c.screen === s.doc.screen).length;
          const pills = [
            sum.blocking ? `<span class="pill block">${sum.blocking} ${D.blocking}</span>` : `<span class="pill ok">${D.clean}</span>`,
            sum.warning ? `<span class="pill ok">${sum.warning} ${D.warning}</span>` : '',
            tbd ? `<span class="pill tbd">${tbd} ${D.tbd}</span>` : '',
            open ? `<span class="pill cm">${open} ${open > 1 ? D.commentsN : D.comment}</span>` : '',
          ].join('');
          const states = ['Default', ...Object.keys(s.doc.states ?? {})];
          return `<a class="scard" href="${h(s.doc.screen)}.html"><div class="t">${h(s.doc.screen)}</div><div class="m">${h(s.doc.type)} · ${states.length} ${D.states}: ${h(states.join(', '))}</div><div class="pills">${pills}</div></a>`;
        })
        .join('');
      return `<div class="section-title">${h(section)}</div><div class="card-grid">${items}</div>`;
    })
    .join('');
  const waiting = proposals.length
    ? `<div class="section-title">${D.waitingForPerson}</div><table class="index"><thead><tr><th>${D.proposal}</th><th>${D.screen}</th><th>${D.tier}</th><th>${D.summary}</th><th>${D.lintAfter}</th></tr></thead><tbody>${proposals
        .map((p) => `<tr><td><a href="proposal-${h(p.id)}.html"><u>${h(p.id)}</u></a></td><td>${h(p.screen)}</td><td>${h(p.tier)}</td><td>${h(p.summary)}</td><td class="${p.lint?.after?.blocking ? 'bad' : ''}">${p.lint?.after?.blocking ?? 0} ${D.blocking}, ${p.lint?.after?.warning ?? 0} ${D.warning}</td></tr>`)
        .join('')}</tbody></table>`
    : '';
  const body = `<div class="shell">
${sidebar(project, { current: null, findings, comments, proposals })}
<main class="main">
<header class="top"><h1>${D.overview}</h1><span class="meta">${project.screens.length} ${D.screens}${branch ? ` ${D.on} ${h(branch)}` : ''} — ${total.blocking} ${D.blocking}, ${total.warning} ${D.warning}${comments.length ? `, ${comments.length} ${D.openComments}` : ''}</span></header>
${waiting}
${cards}
</main>
<aside id="inspector" class="drawer"></aside>
</div>`;
  return page({ title: D.screens, tokens, body, api, screen: '', comments: [], lang });
}

// A pending proposal drawn as a decision page: what was agreed, what changes, and every
// state AS-IS beside TO-BE. This is the sketch step of DESIGN.md §7 — nothing is written
// until a person has seen the screen it would produce.
export function renderProposal(project, proposal, { branch = null, adapter = null, api = false } = {}) {
  const lang = languageOf(project);
  const D = dictionary(lang);
  setLanguage(lang);
  const tokens = mergeTokens(DEFAULT_TOKENS, project.tokens);
  const maps = mapsFor(project);
  const before = parseScreenText(proposal.before, proposal.file);
  const after = parseScreenText(proposal.after, proposal.file);
  const known = project.conventions.states?.known ?? [];
  const present = [...new Set([...Object.keys(before.doc.states ?? {}), ...Object.keys(after.doc.states ?? {})])];
  const states = ['Default', ...known.filter((k) => k !== 'Default' && present.includes(k)), ...present.filter((k) => !known.includes(k))];

  const tabs = states.map((s, i) => `<button class="tab${i === 0 ? ' active' : ''}" data-state="${h(s)}" data-target="pair-${h(s)}">${h(s)}</button>`).join('');
  const panels = states
    .map((state, i) => {
      const a = before.doc.states?.[state] || state === 'Default' ? renderView(project, before, mergeState(before.doc, state), maps, adapter) : `<div class="hint">${D.notInAsis}</div>`;
      const b = after.doc.states?.[state] || state === 'Default' ? renderView(project, after, mergeState(after.doc, state), maps, adapter) : `<div class="hint">${D.removedInTobe}</div>`;
      return `<section class="state${i === 0 ? ' active' : ''}" id="pair-${h(state)}"><div class="states compare"><div class="state active" id="asis-${h(state)}" style="display:block"><h3 style="display:block">${D.asis}</h3>${a}</div><div class="state active" id="tobe-${h(state)}" style="display:block"><h3 style="display:block">${D.tobe}</h3>${b}</div></div></section>`;
    })
    .join('');

  const decisions = (proposal.decisions ?? []).length
    ? `<table class="index"><thead><tr><th>${D.item}</th><th>${D.decision}</th><th>${D.why}</th></tr></thead><tbody>${proposal.decisions.map((d) => `<tr><td>${h(d.item)}</td><td>${h(d.decision)}</td><td>${h(d.why ?? '')}</td></tr>`).join('')}</tbody></table>`
    : `<div class="hint">${D.noDecisions}</div>`;
  const cell = (x) => (x === undefined ? '' : `<code>${h(JSON.stringify(x))}</code>`);
  const rows = [
    ...proposal.diff.changed.map((e) => [e.path.join('.'), e.before, e.after]),
    ...proposal.diff.added.map((e) => [e.path.join('.'), undefined, e.after]),
    ...proposal.diff.removed.map((e) => [e.path.join('.'), e.before, undefined]),
  ];
  const diff = `<table class="index"><thead><tr><th>${D.where}</th><th>${D.asis}</th><th>${D.tobe}</th></tr></thead><tbody>${rows.map(([w, a, b]) => `<tr><td>${h(w)}</td><td>${cell(a)}</td><td>${cell(b)}</td></tr>`).join('')}</tbody></table>`;
  const lintLine = `lint ${proposal.lint.before.blocking}→${proposal.lint.after.blocking} ${D.blocking}, ${proposal.lint.before.warning}→${proposal.lint.after.warning} ${D.warning}`;
  const verdict =
    api && proposal.status === 'pending'
      ? `<p><input id="by" placeholder="${D.yourName}" style="width:160px;display:inline-block"> <button class="btn btn-primary" id="approve" data-id="${h(proposal.id)}">${D.apply}</button> <button class="btn btn-danger" id="reject" data-id="${h(proposal.id)}">${D.reject}</button> <span class="hint" id="verdict"></span></p>`
      : `<p class="hint">${D.toAccept}: <code>doan apply &lt;project&gt; ${h(proposal.id)} --by &lt;you&gt;</code> · ${D.toDecline}: <code>doan reject &lt;project&gt; ${h(proposal.id)} --reason "…"</code></p>`;

  const body = `<div class="shell">
${sidebar(project, { current: proposal.screen })}
<main class="main">
<header class="top"><h1>${h(proposal.screen)} <span class="hint">${D.proposal}</span></h1><span class="meta">${h(proposal.status)} · ${D.tier} ${h(proposal.tier)} · ${h(lintLine)}${branch ? ` · ${h(branch)}` : ''}</span><span class="spacer"></span><label class="toggle"><input type="checkbox" id="dev"> ${D.paths}</label></header>
<p style="font-size:15px;margin:0 0 var(--space-md)">${h(proposal.summary || D.noSummary)}</p>
<div class="section-title">${D.decided}</div>${decisions}
<div class="section-title">${D.whatChanges}</div>${diff}
${verdict}
<div class="section-title">${D.asisTobe}</div>
<div class="tabs-row">${tabs}</div>
<div class="states">${panels}</div>
</main>
<aside id="inspector" class="drawer"></aside>
</div>`;
  return page({ title: `${D.proposal} ${proposal.id}`, tokens, extraCss: adapter?.styles ? adapter.styles() : '', file: proposal.file, body, api, screen: proposal.screen, comments: [], lang });
}
