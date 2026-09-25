// The bundled component set: one function per kind, each returning the INSIDE of the
// element's wrapper. `h` escapes; `v` renders any prop value (a $tbd becomes a chip).
// A kind with no entry falls back to `generic`, which shows the kind and its props —
// the renderer never refuses a kind, the same way lint only warns on one (L10).

import { dictionary } from './i18n.js';

// The language the bundled set speaks. Set once per render by renderScreen/renderIndex;
// module state is fine because a render is synchronous.
let D = dictionary('en');
export function setLanguage(lang) {
  D = dictionary(lang);
}

export const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const isTbd = (x) => x && typeof x === 'object' && !Array.isArray(x) && '$tbd' in x;

// an icon prop is a glyph, or a file when it names one under assets/. The test is repeated from
// src/assets.js on purpose: init copies this file into a project, where ../assets.js is not.
const isAssetRef = (x) => typeof x === 'string' && /^assets\/\S+\.(svg|png|jpe?g|gif|webp|avif)$/i.test(x);
export const ico = (x) => (isAssetRef(x) ? `<img class="ico-img" src="${h(x)}" alt="">` : v(x));
export function v(value) {
  if (value === undefined || value === null) return '';
  if (isTbd(value)) {
    const m = value.$tbd ?? {};
    const who = [m.owner, m.due].filter(Boolean).join(' · ');
    return `<span class="tbd" title="${h(m.note ?? '')}">TBD${who ? ' ' + h(who) : ''}</span>`;
  }
  if (Array.isArray(value)) return value.map(v).join(', ');
  if (typeof value === 'object') return h(JSON.stringify(value));
  return h(value);
}

const label = (c) => (typeof c === 'object' && c && !isTbd(c) ? c.label ?? c.key ?? c.id ?? JSON.stringify(c) : c);

const RESERVED = new Set(['id', 'kind', 'children', 'show_when', 'disabled_when', 'reveals']);
const props = (el) => Object.entries(el).filter(([k]) => !RESERVED.has(k));

const list = (items) => (Array.isArray(items) ? items : items === undefined ? [] : [items]);

// A cell with no value gets a sample made from its column name, so the picture reads as a
// screen and not as a broken one. The inspector says the values are samples.
export function sample(key, i = 0) {
  const k = String(typeof key === 'object' && key ? key.key ?? key.label ?? key.id ?? '' : key ?? '').toLowerCase();
  const n = i + 1;
  if (/percent|rate|level|uptime|%/.test(k)) return ['92%', '47%', '18%'][i % 3];
  if (/\b(date|time|created|updated|paid|ordered)\b|_at$|\bat\b/.test(k)) return ['2026-09-24 10:12', '2026-09-23 18:40', '2026-09-21 09:05'][i % 3];
  if (/amount|price|total|sales|revenue|cost|sum|value|avg|average/.test(k)) return ['12,400', '8,900', '31,250'][i % 3];
  if (/_no$|\bno\b|number|order_no|\bid$/.test(k)) return `ORD-${1040 + n}`;
  if (/status|state/.test(k)) return D.s_status[i % 3];
  if (/count|qty|quantity|orders|visitors|units|rank/.test(k)) return String([128, 64, 12][i % 3]);
  if (/name|title|item|product/.test(k)) return D.s_item(n);
  if (/store|branch|shop/.test(k)) return D.s_stores[i % 3];
  if (/method|type|kind/.test(k)) return D.s_method[i % 3];
  if (/email/.test(k)) return `user${n}@example.com`;
  if (/phone/.test(k)) return '010-1234-5678';
  if (/version/.test(k)) return `v2.${n}.0`;
  if (/duration|fulfil|elapsed/.test(k)) return ['4m 12s', '3m 48s', '6m 01s'][i % 3];
  return D.s_sample(n);
}

export const kinds = {
  generic(el, r) {
    const rows = props(el).map(([k, val]) => `<div class="prop"><span class="k">${h(k)}</span><span class="v">${v(val)}</span></div>`).join('');
    return `<div class="generic-head">${h(el.kind)}</div>${rows}${r.children(el)}`;
  },
  'page-header'(el, r) {
    const actions = list(el.actions).map((a) => (typeof a === 'object' && a.kind ? r.element(a) : `<button class="btn">${v(a)}</button>`)).join('');
    const tabs = list(el.tabs).map((t, i) => `<span class="tab${i === 0 ? ' active' : ''}" data-ui-tab>${v(t)}</span>`).join('');
    return `<div class="ph-left"><h2>${v(el.title)}</h2>${tabs ? `<div class="tabs">${tabs}</div>` : ''}</div><div class="ph-actions">${actions}${r.children(el)}</div>`;
  },
  card(el, r) {
    return `${el.title ? `<div class="card-title">${v(el.title)}${el.hint ? ` <span class="hint">${v(el.hint)}</span>` : ''}</div>` : ''}${r.children(el)}`;
  },
  section(el, r) {
    return `${el.title ? `<div class="section-title">${v(el.title)}</div>` : ''}${r.children(el)}`;
  },
  fieldset(el, r) {
    return `${r.children(el)}${el.hint ? `<div class="hint">${v(el.hint)}</div>` : ''}`;
  },
  group(el, r) {
    return r.children(el);
  },
  'filter-bar'(el, r) {
    return r.children(el);
  },
  'filter-form'(el) {
    return list(el.fields).map((f) => `<label class="fld"><span>${v(label(f))}</span><input readonly placeholder="${h(label(f))}"></label>`).join('');
  },
  segmented(el) {
    return `<div class="seg">${list(el.options).map((o, i) => `<span class="${i === 0 ? 'on' : ''}">${v(o)}</span>`).join('')}</div>`;
  },
  'button-group'(el) {
    return `<div class="seg">${list(el.options).map((o, i) => `<span class="${i === 0 ? 'on' : ''}">${v(o)}</span>`).join('')}</div>`;
  },
  button(el) {
    const variant = el.variant ?? 'default';
    return `<button class="btn btn-${h(variant)}"${el.disabled ? ' disabled' : ''}>${v(el.label ?? el.title ?? el.id)}</button>`;
  },
  caption(el) {
    return `<span class="caption">${v(el.text)}</span>`;
  },
  hint(el) {
    return `<span class="hint">${el.icon ? `<span class="ico">${ico(el.icon)}</span> ` : ''}${v(el.text)}</span>`;
  },
  divider() {
    return `<hr>`;
  },
  table(el) {
    const cols = list(el.columns);
    const head = cols.map((c) => `<th>${v(label(c))}${typeof c === 'object' && c?.sortable ? ' ↕' : ''}</th>`).join('');
    const cell = (c, i) => {
      if (typeof c === 'object' && c?.kind === 'progress') return `<td><div class="bar"><span style="width:${[62, 38, 84][i % 3]}%"></span></div></td>`;
      if (typeof c === 'object' && c?.sub) return `<td>${h(sample(c, i))}<div class="sub">${v(c.sub)}</div></td>`;
      return `<td>${h(sample(c, i))}</td>`;
    };
    const rows = Array.from({ length: 3 }, (_, i) => `<tr>${el.selectable ? '<td class="chk">☐</td>' : ''}${cols.map((c) => cell(c, i)).join('')}</tr>`).join('');
    return `<table><thead><tr>${el.selectable ? '<th class="chk"></th>' : ''}${head}</tr></thead><tbody>${rows}</tbody></table>${el.row_action ? `<div class="hint">row → ${v(el.row_action)}</div>` : ''}`;
  },
  pagination(el) {
    return `<div class="pager">‹ <span class="on">1</span> 2 3 ›${el.page_size ? ` <span class="hint">${h(el.page_size)}${D.perPage}</span>` : ''}</div>`;
  },
  'empty-notice'(el) {
    return `<div class="notice"><div class="notice-icon">○</div><div class="notice-title">${v(el.title ?? D.nothingHere)}</div><div class="notice-text">${v(el.text)}</div></div>`;
  },
  'error-notice'(el) {
    return `<div class="notice error"><div class="notice-icon">!</div><div class="notice-title">${v(el.title ?? D.wentWrong)}</div><div class="notice-text">${v(el.text)}</div></div>`;
  },
  skeleton(el) {
    return Array.from({ length: Math.min(Number(el.rows) || 3, 6) }, () => `<div class="skel"></div>`).join('');
  },
  overlay(el) {
    return `<div class="overlay-box">${v(el.text ?? D.loading)}</div>`;
  },
  toast(el) {
    return `<div class="toast ${h(el.level ?? 'info')}">${v(el.text)}</div>`;
  },
  placeholder(el) {
    return `<div class="ph-label">${D.undesigned}</div><div class="ph-text">${v(el.text)}</div>`;
  },
  modal(el, r) {
    return `<div class="modal-title">${v(el.title)}</div><div class="modal-body">${r.children(el)}</div>${el.notice ? `<div class="notice-inline">${v(el.notice.title ?? el.notice)}</div>` : ''}`;
  },
  confirm(el) {
    return `<div class="confirm"><div class="modal-title">${v(el.title)}</div><div>${v(el.text)}</div><div class="row end">${list(el.buttons).map((b) => `<button class="btn">${v(b)}</button>`).join('')}</div></div>`;
  },
  field(el, r) {
    const c = el.control;
    const control = c && typeof c === 'object' && !isTbd(c) ? r.element({ id: `${el.id}-control`, ...c }) : `<input readonly>`;
    return `<div class="fld-label">${v(el.label)}${el.caption ? `<div class="hint">${v(el.caption)}</div>` : ''}</div><div class="fld-control">${control}${el.error ? `<div class="err">${v(el.error)}</div>` : ''}${el.reveals ? `<div class="hint">reveals: ${v(Object.keys(el.reveals).join(', '))}</div>` : ''}</div>`;
  },
  input(el) {
    return `<input readonly${el.readonly ? ' class="ro"' : ''} value="${h(el.text ?? el.value ?? '')}" placeholder="${h(el.placeholder ?? '')}">`;
  },
  number(el) {
    return `<input readonly type="number" value="${h(el.value ?? '')}">`;
  },
  textarea(el) {
    return `<textarea readonly rows="2" placeholder="${h(el.placeholder ?? '')}"></textarea>${el.counter ? `<div class="hint">${v(el.counter)}</div>` : ''}`;
  },
  select(el) {
    return `<div class="select">${v(Array.isArray(el.options) ? el.options[0] : el.options ?? D.select)} ▾</div>`;
  },
  radio(el) {
    return `<div class="radio">${list(el.options).map((o, i) => `<label><span class="dot-r${i === 0 ? ' on' : ''}"></span>${v(o)}</label>`).join('')}</div>`;
  },
  date(el) {
    return `<div class="select">${h(el.format ?? 'YYYY.MM.DD')} ▾</div>`;
  },
  'date-range'(el) {
    return `<div class="row"><div class="select">${h(el.format ?? 'YYYY.MM.DD')}</div> ~ <div class="select">${h(el.format ?? 'YYYY.MM.DD')}</div></div>`;
  },
  upload(el) {
    return `<button class="btn">${v(el.label ?? D.chooseFile)}</button>`;
  },
  image(el) {
    // a real picture when src names a file under assets/, the placeholder otherwise
    const pic = isAssetRef(el.src) ? `<img src="${h(el.src)}" alt="${h(el.alt ?? '')}">` : D.image;
    return `<div class="img size-${h(el.size ?? 'md')}">${pic}</div>`;
  },
  'kv-table'(el) {
    const rows = Array.isArray(el.rows) ? el.rows : [];
    const body = rows.map((r, i) => `<tr>${list(r).map((k) => `<th>${v(k)}</th><td>${h(sample(k, i))}</td>`).join('')}</tr>`).join('');
    return `${el.title ? `<div class="section-title">${v(el.title)}</div>` : ''}<table class="kv">${body || `<tr><td class="hint">${v(el.rows)}</td></tr>`}</table>`;
  },
  'detail-card'(el) {
    return `<table class="kv">${list(el.fields).map((f, i) => `<tr><th>${v(f)}</th><td>${h(sample(f, i))}</td></tr>`).join('')}</table>`;
  },
  'stat-strip'(el) {
    return `<div class="stats">${list(el.stats).map((s, i) => `<div class="stat"><div class="stat-v">${h(sample(s, i))}</div><div class="stat-l">${v(s)}</div></div>`).join('')}</div>`;
  },
  'tile-grid'(el) {
    const n = Math.min(Number(el.per_page) || 25, 100);
    return `<div class="tiles" style="--cols:${Number(el.columns) || 10}">${Array.from({ length: n }, (_, i) => `<span class="tile t${i % 5}"></span>`).join('')}</div>`;
  },
  tooltip(el) {
    return `<span class="hint" title="${h(list(el.items).join(' · '))}">ⓘ</span>`;
  },
  'sortable-list'(el) {
    return `<div class="sortable">${Array.from({ length: 3 }, (_, i) => `<div class="sort-item">⋮⋮ ${v(el.item ?? 'item')} ${i + 1}</div>`).join('')}</div>`;
  },
  nav(el) {
    return `<div class="nav">${list(el.items).map((i, k) => `<div class="nav-item${k === 0 ? ' on' : ''}">${v(label(i))}</div>`).join('') || `<div class="nav-item on">${D.menu}</div>`}</div>`;
  },
  checkbox(el) {
    return `<label class="chk-line"><span class="box${el.checked ? ' on' : ''}"></span>${v(el.label ?? el.text ?? el.id)}</label>`;
  },
  switch(el) {
    return `<span class="sw${el.on ? ' on' : ''}"></span> ${v(el.label ?? '')}`;
  },
  tag(el) {
    return `<span class="tag">${v(el.text ?? el.label ?? el.id)}</span>`;
  },
  // mobile
  'app-bar'(el, r) {
    const actions = list(el.actions).map((a) => (typeof a === 'object' && a.kind ? r.element(a) : `<span class="ab-action">${v(a)}</span>`)).join('');
    return `<div class="ab-left">${el.back ? '<span class="ab-back">‹</span>' : ''}</div><div class="ab-title">${v(el.title)}</div><div class="ab-actions">${actions}</div>`;
  },
  'tab-bar'(el) {
    return `<div class="tb">${list(el.tabs).map((t) => `<div class="tb-item${String(label(t)) === String(el.active ?? list(el.tabs)[0]) ? ' on' : ''}"><span class="tb-icon"></span>${v(label(t))}</div>`).join('')}</div>`;
  },
  'list-cell'(el) {
    return `<div class="cell">${el.thumbnail ? '<span class="cell-thumb"></span>' : ''}<div class="cell-body"><div class="cell-title">${v(el.title ?? el.label ?? el.id)}</div>${el.subtitle ? `<div class="cell-sub">${v(el.subtitle)}</div>` : ''}</div>${el.value !== undefined ? `<div class="cell-value">${v(el.value)}</div>` : ''}${el.trailing !== undefined ? `<div class="cell-trail">${v(el.trailing)}</div>` : ''}${el.chevron === false ? '' : '<span class="cell-chevron">›</span>'}</div>`;
  },
  'bottom-sheet'(el, r) {
    return `<div class="sheet"><div class="sheet-handle"></div>${el.title ? `<div class="sheet-title">${v(el.title)}</div>` : ''}<div class="sheet-body">${r.children(el)}</div></div>`;
  },
  fab(el) {
    return `<button class="fab" title="${h(el.label ?? '')}">${ico(el.icon ?? '+')}</button>`;
  },
  snackbar(el) {
    return `<div class="snack">${v(el.text)}${el.action ? `<span class="snack-action">${v(el.action)}</span>` : ''}</div>`;
  },
  chip(el) {
    return `<span class="chip${el.selected ? ' on' : ''}">${v(el.label ?? el.text ?? el.id)}</span>`;
  },
  'search-bar'(el) {
    return `<div class="search"><span class="search-icon">⌕</span><input readonly placeholder="${h(el.placeholder ?? D.select)}"></div>`;
  },
  segment(el) {
    return `<div class="seg">${list(el.options).map((o, i) => `<span class="${String(o) === String(el.selected ?? list(el.options)[0]) ? 'on' : ''}">${v(o)}</span>`).join('')}</div>`;
  },
  stepper(el) {
    return `<div class="stepper"><span class="step-btn">−</span><span class="step-val">${v(el.value ?? 1)}</span><span class="step-btn">+</span></div>`;
  },
  'pull-to-refresh'(el) {
    return `<div class="ptr${el.active ? ' on' : ''}">${el.active ? '◌' : '↓'}</div>`;
  },
  'sheet-handle'() {
    return `<div class="sheet-handle"></div>`;
  },
  tile(el) {
    return `<span class="tile t${(String(el.status ?? el.id).length) % 5}" title="${h(el.label ?? el.id)}"></span>`;
  },
  progress() {
    return `<div class="bar"><span style="width:62%"></span></div>`;
  },
};
