import { mergeState } from '../merge.js';
import { walkElements } from '../elements.js';
import { lint, summarize } from '../lint.js';
import { resolveFlowTarget } from '../flows.js';
import { kinds, h, v, isTbd, setLanguage } from './kinds.js';
import { dictionary, languageOf, pageStrings } from './i18n.js';
import { DEFAULT_TOKENS, mergeTokens, tokenVar, tokensToCss } from './tokens.js';
import { CSS, INSPECTOR_JS } from './page.js';
import { parseScreenText } from '../project.js';
import { enumAttrs } from '../components.js';
import { expandComponents } from '../expand.js';
import { layoutFlows } from '../flowmap.js';

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

function makeRenderer(screen, layout, maps, adapter = null, components = {}) {
  const lines = new Map();
  for (const { el, path } of walkElements(screen.doc.elements ?? [], ['elements'])) lines.set(el.id, { path: path.join('.'), line: screen.lineOf(path) });

  const r = {
    element(el, path = null) {
      // an expanded compound (src/expand.js) draws as a container of the tree its contract declared;
      // its children point the inspector at the component file, not the screen
      const fn = el.$expanded ? kinds.group : (adapter?.kinds?.[el.kind] ?? kinds[el.kind] ?? kinds.generic);
      const known = lines.get(el.id) ?? (el.$from ? { path: `${el.$from.file} › ${el.$from.path}`, line: null } : undefined);
      const style = layoutStyle(layout[el.id], { container: !!el.children?.length });
      const propsJson = h(JSON.stringify(Object.fromEntries(Object.entries(el).filter(([k]) => k !== 'children' && !k.startsWith('$')))));
      const cls = ['el', `el-${el.kind}`, kinds[el.kind] || el.$expanded ? '' : 'el-unknown', el.disabled_when ? 'is-disabled' : ''].filter(Boolean).join(' ');
      // `repeat: N` (what an import writes for a run of identical instances) draws the element N times in a row.
      const once = fn(el, r);
      const inner = el.repeat > 1 ? `<div class="repeat">${Array.from({ length: Math.min(Number(el.repeat), 200) }, () => `<div class="rep">${once}</div>`).join('')}</div>` : once;
      // each enum prop the contract declares becomes data-<prop>, which is what a variant's css binds to
      const attrs = Object.entries(enumAttrs(components[el.kind], el)).map(([k, val]) => ` data-${attrName(k)}="${h(val)}"`).join('');
      return `<div class="${cls}" data-id="${h(el.id)}" data-kind="${h(el.kind)}" data-path="${h(known?.path ?? path ?? '')}" data-line="${known?.line ?? ''}" data-maps="${h(maps[el.kind] ?? '')}" data-props="${propsJson}"${attrs}${style ? ` style="${style}"` : ''}>${dots(el)}${inner}</div>`;
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
};
export function platformOf(project, screen) {
  const table = { ...DEFAULT_PLATFORMS, ...(project.conventions.platforms ?? {}) };
  const name = screen.doc.platform ?? table.default ?? 'web';
  const spec = table[name] ?? DEFAULT_PLATFORMS.web;
  return { name, width: spec.width ?? 1280, height: spec.height ?? null, frame: spec.frame ?? 'none' };
}

function renderView(project, screen, merged, maps, adapter = null) {
  const view = expandComponents(merged, project.components ?? {});
  const r = makeRenderer(screen, view.layout, maps, adapter, project.components ?? {});
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
  for (const [kind, def] of Object.entries(project.components ?? project.conventions.kinds ?? {})) {
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
  const nComponents = Object.keys(project.components ?? {}).length;
  const foot = `<div class="foot"><a class="side-link${current === null ? ' current' : ''}" href="index.html"><span class="name">${D.overview}</span>${proposals.length ? `<span class="pill cm">${proposals.length} ${D.waiting}</span>` : ''}</a><a class="side-link${current === 'components' ? ' current' : ''}" href="components.html"><span class="name">${D.library}</span><span class="hint">${nComponents}</span></a><a class="side-link${current === 'flows' ? ' current' : ''}" href="flows.html"><span class="name">${D.flowMap}</span></a></div>`;
  return `<nav class="side"><div class="brand">${D.screens} <span class="hint">${project.screens.length}</span></div>${links}${foot}</nav>`;
}

// Modes. Every modifier axis of the project's token resolver (theme: light | dark …) becomes
// a data attribute on <html> and a select in the header: `data-theme="dark"` swaps the custom
// properties for that context's set. The bundled kinds and the page chrome follow at once; a
// component library's own pieces keep the default context, since their theme was baked in
// server-side. No resolver, no controls.
const attrName = (s) => String(s).toLowerCase().replace(/[^a-z0-9_-]/g, '-');

function modeCss(project) {
  const contexts = project.tokenSet?.contexts ?? {};
  return Object.entries(contexts)
    .flatMap(([axis, byCtx]) => Object.entries(byCtx).map(([ctx, t]) => tokensToCss(mergeTokens(DEFAULT_TOKENS, t)).replace(/^:root/, `:root[data-${attrName(axis)}="${h(ctx)}"]`)))
    .join('\n');
}

function modeControls(project) {
  const contexts = project.tokenSet?.contexts ?? {};
  const defaults = project.tokenSet?.defaults ?? {};
  return Object.entries(contexts)
    .map(([axis, byCtx]) => `<label class="toggle">${h(axis)} <select data-mode="${attrName(axis)}">${Object.keys(byCtx).map((c) => `<option value="${h(c)}"${c === defaults[axis] ? ' selected' : ''}>${h(c)}</option>`).join('')}</select></label>`)
    .join('');
}

// Component bindings. A contract's `tokens:` become custom properties scoped to the element's
// wrapper — `--k-button-bg: var(--color-primary)` — and a variant's overrides sit on the
// wrapper's data attribute for that prop. Namespaced by kind, so a card's padding never leaks
// into the button inside it; written as var(--token), so a theme switch flows through.
function componentCss(project) {
  const rules = [];
  for (const c of Object.values(project.components ?? {})) {
    const decl = (b) => Object.entries(b ?? {}).map(([slot, token]) => `--k-${attrName(c.kind)}-${attrName(slot)}: ${tokenVar(token)}`).join('; ');
    if (c.tokens && Object.keys(c.tokens).length) rules.push(`.el-${attrName(c.kind)} { ${decl(c.tokens)}; }`);
    for (const [prop, options] of Object.entries(c.variants ?? {}))
      for (const [opt, b] of Object.entries(options ?? {})) if (b && Object.keys(b).length) rules.push(`.el-${attrName(c.kind)}[data-${attrName(prop)}="${h(opt)}"] { ${decl(b)}; }`);
  }
  return rules.join('\n');
}

function page({ title, tokens, modeCss = '', componentCss = '', extraCss = '', file = '', body, api = false, screen = '', comments = [], lang = 'en' }) {
  return `<!doctype html>
<html lang="${h(lang)}"><head><meta charset="utf-8"><title>${h(title)}</title>
<style>${tokensToCss(tokens)}\n${modeCss}\n${componentCss}\n${CSS}</style>${extraCss}</head>
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
<header class="top"><h1>${h(doc.screen)}</h1><span class="meta">${h(doc.section)} · ${h(doc.type)} · ${h(platformOf(project, screen).name)}${adapter ? ` · ${h(adapter.name)} ${D.components}` : ''}${branch ? ` · ${h(branch)}` : ''}</span><span class="spacer"></span>${modeControls(project)}<label class="toggle"><input type="checkbox" id="compare"> ${D.compare}</label><label class="toggle"><input type="checkbox" id="dev"> ${D.paths}</label></header>
<div class="tabs-row">${stateTabs}${variantTabs ? `<span class="axis" style="margin-left:var(--space-md)">${D.variants}</span>${variantTabs}` : ''}</div>
<div class="states">${statePanels}${variantPanels}</div>
<div class="section-title">${D.flows}</div><ul class="list">${flows || `<li class="hint">${D.none}</li>`}</ul>
<div class="section-title">${D.notes}</div><ul class="list">${notes || `<li class="hint">${D.none}</li>`}</ul>
<div class="section-title">${D.comments} <span class="hint">${comments.length} ${D.open}</span></div><ul class="list" id="comments">${commentList || `<li class="hint">${D.none}</li>`}</ul>
${refs ? `<div class="section-title">${D.references}</div><div class="hint" style="font-size:12px">${refs}</div>` : ''}
</main>
<aside id="inspector" class="drawer"></aside>
</div>`;
  return page({ title: doc.screen, tokens, modeCss: modeCss(project), componentCss: componentCss(project), extraCss: adapter?.styles ? adapter.styles() : '', file: screen.file, body, api, screen: doc.screen, comments, lang });
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
<header class="top"><h1>${D.overview}</h1><span class="meta">${project.screens.length} ${D.screens}${branch ? ` ${D.on} ${h(branch)}` : ''} — ${total.blocking} ${D.blocking}, ${total.warning} ${D.warning}${comments.length ? `, ${comments.length} ${D.openComments}` : ''}</span><span class="spacer"></span>${modeControls(project)}</header>
${waiting}
${cards}
</main>
<aside id="inspector" class="drawer"></aside>
</div>`;
  return page({ title: D.screens, tokens, modeCss: modeCss(project), componentCss: componentCss(project), body, api, screen: '', comments: [], lang });
}

// A pending proposal drawn as a decision page: what was agreed, what changes, and every
// state AS-IS beside TO-BE. This is the sketch step of DESIGN.md §7 — nothing is written
// until a person has seen the screen it would produce.
// The library: every contract in the registry, drawn from its own sample — one picture, and
// one more per option of every prop that carries variant bindings — with its props, slots and
// bindings beside it. What a Figma library page was: the design system, seen whole.
export function renderLibrary(project, { branch = null, adapter = null, api = false } = {}) {
  const lang = languageOf(project);
  const D = dictionary(lang);
  setLanguage(lang);
  const tokens = mergeTokens(DEFAULT_TOKENS, project.tokens);
  const maps = mapsFor(project);
  const registry = project.components ?? {};
  const stub = { doc: { elements: [] }, lineOf: () => null };
  const picture = (contract, el) => {
    const view = expandComponents({ elements: [el], layout: {} }, registry);
    const r = makeRenderer(stub, view.layout, maps, adapter, registry);
    return `<div class="lib-pic">${view.elements.map((x) => r.element(x)).join('')}</div>`;
  };
  const propRow = ([name, def]) => {
    const type = def?.type ?? 'any';
    const detail = type === 'enum' ? (def.options ?? []).join(' · ') : def?.default !== undefined ? `= ${v(def.default)}` : '';
    return `<tr><td><code>${h(name)}</code>${def?.required ? ` <span class="pill tbd">${D.requiredMark}</span>` : ''}</td><td class="hint">${h(type)}</td><td>${h(detail)}</td><td class="hint">${h(def?.description ?? '')}</td></tr>`;
  };
  const bindingRows = (contract) => {
    const rows = Object.entries(contract.tokens ?? {}).map(([slot, t]) => `<tr><td><code>${h(slot)}</code></td><td><code>${h(t)}</code></td></tr>`);
    for (const [prop, options] of Object.entries(contract.variants ?? {}))
      for (const [opt, b] of Object.entries(options ?? {})) for (const [slot, t] of Object.entries(b ?? {})) rows.push(`<tr><td><code>${h(slot)}</code> <span class="hint">${h(prop)}=${h(opt)}</span></td><td><code>${h(t)}</code></td></tr>`);
    return rows.join('');
  };
  const sections = Object.values(registry)
    .sort((a, b) => a.kind.localeCompare(b.kind))
    .map((c) => {
      const sample = { id: `sample-${c.kind}`, kind: c.kind, ...(c.sample ?? {}) };
      const variantPics = Object.entries(c.variants ?? {})
        .flatMap(([prop, options]) => Object.keys(options ?? {}).map((opt) => `<div class="lib-variant"><div class="hint">${h(prop)} = ${h(opt)}</div>${picture(c, { ...sample, id: `${sample.id}-${prop}-${opt}`, [prop]: c.props?.[prop]?.type === 'boolean' ? opt === 'true' : opt })}</div>`))
        .join('');
      const compound = Array.isArray(c.elements) && c.elements.length;
      const meta = [c.file ? `components/${h(basenameOf(c.file))}` : `<span class="bad">${D.legacyKind}</span>`, maps[c.kind] ? `${h(maps[c.kind])}` : '', compound ? D.compound : ''].filter(Boolean).join(' · ');
      const props = Object.entries(c.props ?? {});
      return `<section class="lib" id="k-${h(c.kind)}">
<h3>${h(c.kind)}</h3><div class="hint">${h(c.description ?? '')}</div><div class="hint lib-meta">${meta}</div>
<div class="lib-row">${picture(c, sample)}${variantPics ? `<div class="lib-variants">${variantPics}</div>` : ''}</div>
${props.length ? `<div class="section-title">${D.propsLabel}</div><table class="props">${props.map(propRow).join('')}</table>` : ''}
${c.slots?.length ? `<div class="section-title">${D.slotsLabel}</div><div class="hint">${c.slots.map((s) => `<code>${h(s)}</code>`).join(' ')}</div>` : ''}
${c.tokens || c.variants ? `<div class="section-title">${D.bindingsLabel}</div><table class="props">${bindingRows(c)}</table>` : ''}
</section>`;
    })
    .join('');
  const body = `<div class="shell">
${sidebar(project, { current: 'components', proposals: [] })}
<main class="main">
<header class="top"><h1>${D.library}</h1><span class="meta">${Object.keys(registry).length}${branch ? ` · ${h(branch)}` : ''}</span><span class="spacer"></span>${modeControls(project)}</header>
${sections || `<div class="hint">${D.noneOfKind}</div>`}
</main>
<aside id="inspector" class="drawer"></aside>
</div>`;
  return page({ title: D.library, tokens, modeCss: modeCss(project), componentCss: componentCss(project), extraCss: adapter?.styles ? adapter.styles() : '', body, api, screen: '', comments: [], lang });
}
const basenameOf = (p) => String(p).split('/').pop();

// The flow map (src/flowmap.js): sections as boxes, screens as nodes — a scaled Default with a
// row per state — and flows as right-angle paths that land on the row of the state they name.
// Nodes are HTML so the thumbnails are the same drawing the screen page shows; edges are one
// SVG on top. Async because ELK is.
export async function renderFlows(project, { branch = null, adapter = null, api = false } = {}) {
  const lang = languageOf(project);
  const D = dictionary(lang);
  setLanguage(lang);
  const tokens = mergeTokens(DEFAULT_TOKENS, project.tokens);
  const maps = mapsFor(project);
  const map = await layoutFlows(project);
  const r1 = (n) => Math.round(n * 10) / 10;
  const thumbOf = (n) => {
    const screen = project.screens.find((s) => s.doc.screen === n.screen);
    const html = renderView(project, screen, mergeState(screen.doc, 'Default'), maps, adapter).replace('<div class="stage', '<div class="thumb-stage');
    return `<div class="thumb" style="width:${n.thumb.w}px;height:${n.thumb.h}px"><div class="thumb-scale" style="transform:scale(${n.thumb.scale})">${html}</div></div>`;
  };
  const lists = `
${map.dead.length ? `<div class="section-title">${D.deadFlows}</div><ul class="list flow-dead">${map.dead.map((d) => `<li><code>${h(d.screen)}</code> ${h(d.from)} → <span class="bad">${h(d.to)}</span></li>`).join('')}</ul>` : ''}
${map.orphans.length ? `<div class="section-title">${D.orphanScreens}</div><ul class="list flow-orphans">${map.orphans.map((o) => `<li><a href="${h(o)}.html"><u>${h(o)}</u></a></li>`).join('')}</ul>` : ''}`;
  let picture;
  if (!map.ok) picture = `<div class="hint">${h(map.reason)}</div>`;
  else {
    const secs = map.sections.map((s) => `<div class="flow-sec" style="left:${r1(s.x)}px;top:${r1(s.y)}px;width:${r1(s.w)}px;height:${r1(s.h)}px"><div class="flow-sec-title">${h(s.title)}</div></div>`).join('');
    const nodes = map.nodes
      .map(
        (n) =>
          // a div, not a link: a thumbnail drawn by a library adapter may hold <a> of its own (antd's pagination does), and a link inside a link closes the outer one
          `<div class="flow-node" style="left:${r1(n.x)}px;top:${r1(n.y)}px;width:${n.w}px;height:${n.h}px"><a class="flow-head" href="${h(n.screen)}.html"><b>${h(n.screen)}</b> <span class="hint">${h(n.type ?? '')} · ${h(n.platform)}</span></a>${thumbOf(n)}${n.rows.map((row) => `<div class="flow-state" style="top:${row.y}px">${h(row.name)}</div>`).join('')}</div>`,
      )
      .join('');
    const edges = map.edges
      .map((e) => {
        const d = 'M' + e.points.map((p) => `${r1(p.x)} ${r1(p.y)}`).join(' L');
        const label = e.labelAt ? `<text class="flow-label" x="${r1(e.labelAt.x)}" y="${r1(e.labelAt.y + 11)}">${h(e.label)}</text>` : '';
        return `<path class="flow-edge${e.style === 'conditional' ? ' conditional' : ''}" d="${d}" marker-end="url(#flow-arrow)"><title>${h(e.screen)} · ${h(e.label)} → ${h(e.to)}</title></path>${label}`;
      })
      .join('');
    const svg = `<svg class="flow-edges" width="${Math.ceil(map.width)}" height="${Math.ceil(map.height)}"><defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker></defs>${edges}</svg>`;
    picture = `<div class="flow-scroll"><div class="flowmap" style="width:${Math.ceil(map.width)}px;height:${Math.ceil(map.height)}px">${secs}${nodes}${svg}</div></div>`;
  }
  const body = `<div class="shell">
${sidebar(project, { current: 'flows', proposals: [] })}
<main class="main">
<header class="top"><h1>${D.flowMap}</h1><span class="meta">${project.screens.length} ${D.screens} · ${map.edges.length} ${D.flows.toLowerCase()}${map.dead.length ? ` · <span class="bad">${map.dead.length} ${D.deadFlows.toLowerCase()}</span>` : ''}${branch ? ` · ${h(branch)}` : ''}</span><span class="spacer"></span>${modeControls(project)}</header>
${picture}
${lists}
</main>
<aside id="inspector" class="drawer"></aside>
</div>`;
  return page({ title: D.flowMap, tokens, modeCss: modeCss(project), componentCss: componentCss(project), extraCss: adapter?.styles ? adapter.styles() : '', body, api, screen: '', comments: [], lang });
}

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
<header class="top"><h1>${h(proposal.screen)} <span class="hint">${D.proposal}</span></h1><span class="meta">${h(proposal.status)} · ${D.tier} ${h(proposal.tier)} · ${h(lintLine)}${branch ? ` · ${h(branch)}` : ''}</span><span class="spacer"></span>${modeControls(project)}<label class="toggle"><input type="checkbox" id="dev"> ${D.paths}</label></header>
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
  return page({ title: `${D.proposal} ${proposal.id}`, tokens, modeCss: modeCss(project), componentCss: componentCss(project), extraCss: adapter?.styles ? adapter.styles() : '', file: proposal.file, body, api, screen: proposal.screen, comments: [], lang });
}
