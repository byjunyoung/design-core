import React from 'react';
import { renderToString } from 'react-dom/server';
import { createCache, extractStyle, StyleProvider } from '@ant-design/cssinjs';
import * as antd from 'antd';
import { h, v, isTbd } from '../kinds.js';
import { DEFAULT_TOKENS, mergeTokens } from '../tokens.js';

// Draws each mapped kind as the antd component its `maps_to.antd` names, server-side, with
// the styles antd generates extracted into the page. Children that the bundled renderer
// already produced are embedded as HTML, so a Card holds whatever is inside it. The theme
// comes from the project's tokens, which is how a team's design system reaches the picture.

const e = React.createElement;
const list = (x) => (Array.isArray(x) ? x : x === undefined ? [] : [x]);
const text = (x) => (isTbd(x) ? `TBD${x.$tbd?.owner ? ` (${x.$tbd.owner})` : ''}` : x === undefined || x === null ? '' : String(x));
const label = (c) => (typeof c === 'object' && c && !isTbd(c) ? c.label ?? c.key ?? c.id ?? JSON.stringify(c) : c);
const raw = (html) => e('div', { dangerouslySetInnerHTML: { __html: html } });
const dummyRows = (cols) => Array.from({ length: 3 }, (_, i) => Object.fromEntries([['key', i], ...cols.map((c) => [c.dataIndex, '—'])]));

function themeFrom(tokens) {
  const t = mergeTokens(DEFAULT_TOKENS, tokens);
  return {
    token: {
      colorPrimary: t.color.primary,
      colorError: t.color.danger,
      colorText: t.color.text,
      colorTextSecondary: t.color.muted,
      colorBorder: t.color.border,
      colorBgContainer: t.color.bg,
      borderRadius: parseInt(t.radius.md, 10) || 8,
      fontFamily: t.font.family,
      fontSize: parseInt(t.font.size, 10) || 14,
    },
  };
}

// One renderer per antd component name. `el` is the screen element, `r` the bundled renderer
// (for children), and each returns a React element.
const components = {
  Button: (el) => e(antd.Button, { type: el.variant === 'primary' ? 'primary' : 'default', danger: el.variant === 'danger', disabled: !!el.disabled || !!el.disabled_when }, text(el.label ?? el.title ?? el.id)),
  Table: (el) => {
    const columns = list(el.columns).map((c, i) => ({ title: text(label(c)), dataIndex: `c${i}`, sorter: typeof c === 'object' && !!c?.sortable }));
    return e(antd.Table, { size: 'small', columns, dataSource: dummyRows(columns), pagination: false, rowSelection: el.selectable ? {} : undefined });
  },
  Pagination: (el) => e(antd.Pagination, { total: 50, pageSize: Number(el.page_size) || 10, size: 'small', showSizeChanger: false }),
  Empty: (el) => e(antd.Empty, { description: text(el.text ?? el.title ?? 'No data') }),
  Result: (el) => e(antd.Result, { status: 'error', title: text(el.title ?? 'Something went wrong'), subTitle: text(el.text) }),
  Skeleton: (el) => e(antd.Skeleton, { active: false, paragraph: { rows: Math.min(Number(el.rows) || 3, 6) } }),
  Descriptions: (el) => {
    const rows = Array.isArray(el.rows) ? el.rows.flat() : list(el.fields);
    return e(antd.Descriptions, { size: 'small', bordered: true, column: Number(el.columns) || 2, title: el.title ? text(el.title) : undefined }, ...rows.map((k, i) => e(antd.Descriptions.Item, { key: i, label: text(k) }, '—')));
  },
  Segmented: (el) => e(antd.Segmented, { options: list(el.options).map(text), value: text(list(el.options)[0]) }),
  Statistic: (el) => e(antd.Space, { size: 'large', wrap: true }, ...list(el.stats).map((s, i) => e(antd.Statistic, { key: i, title: text(s), value: '—' }))),
  Form: (el) => e(antd.Form, { layout: 'inline', size: 'small' }, ...list(el.fields).map((f, i) => e(antd.Form.Item, { key: i, label: text(label(f)) }, e(antd.Input, { placeholder: text(label(f)), readOnly: true })))),
  Input: (el) => e(antd.Input, { readOnly: true, value: text(el.text ?? el.value ?? ''), placeholder: text(el.placeholder), disabled: !!el.readonly }),
  'Input.TextArea': (el) => e(antd.Input.TextArea, { readOnly: true, rows: 2, placeholder: text(el.placeholder), showCount: !!el.max, maxLength: el.max ? Number(el.max) : undefined }),
  InputNumber: (el) => e(antd.InputNumber, { readOnly: true, value: el.value }),
  Select: (el) => e(antd.Select, { style: { minWidth: 160 }, value: text(Array.isArray(el.options) ? el.options[0] : el.options ?? 'Select'), options: list(el.options).map((o) => ({ value: text(o) })) }),
  'Radio.Group': (el) => e(antd.Radio.Group, { value: text(list(el.options)[0]) }, ...list(el.options).map((o, i) => e(antd.Radio, { key: i, value: text(o) }, text(o)))),
  DatePicker: (el) => e(antd.DatePicker, { format: el.format, placeholder: text(el.format ?? 'YYYY.MM.DD') }),
  'DatePicker.RangePicker': (el) => e(antd.DatePicker.RangePicker, { format: el.format }),
  Upload: (el) => e(antd.Button, {}, text(el.label ?? 'Choose file')),
  Divider: () => e(antd.Divider, { style: { margin: '8px 0' } }),
  Alert: (el) => e(antd.Alert, { type: el.level === 'error' ? 'error' : 'info', message: text(el.text), showIcon: true }),
  message: (el) => e(antd.Alert, { type: el.level === 'error' ? 'error' : 'success', message: text(el.text), showIcon: true, banner: true }),
  Spin: (el) => e(antd.Spin, { tip: text(el.text ?? 'Loading…') }, e('div', { style: { height: 48 } })),
  Tag: (el) => e(antd.Tag, {}, text(el.text ?? el.label)),
  Checkbox: (el) => e(antd.Checkbox, { checked: !!el.checked }, text(el.label ?? el.text ?? el.id)),
  Switch: (el) => e(antd.Switch, { checked: !!el.on }),
  Card: (el, r) => e(antd.Card, { size: 'small', title: el.title ? text(el.title) : undefined }, raw(r.children(el))),
  Modal: (el, r) => e(antd.Card, { title: text(el.title), style: { boxShadow: '0 8px 32px rgba(0,0,0,.25)' } }, raw(r.children(el))),
  'Modal.confirm': (el) => e(antd.Card, { size: 'small', title: text(el.title) }, e('p', null, text(el.text)), e(antd.Space, null, ...list(el.buttons).map((b, i) => e(antd.Button, { key: i, type: i === list(el.buttons).length - 1 ? 'primary' : 'default' }, text(b))))),
  Tooltip: (el) => e(antd.Tag, { color: 'default' }, `ⓘ ${text(el.trigger ?? 'tooltip')}`),
};

export function create(project) {
  const cache = createCache();
  const theme = themeFrom(project.tokens);
  const mapped = {};
  for (const [kind, def] of Object.entries(project.conventions.kinds ?? {})) {
    const name = def?.maps_to?.antd;
    if (name && components[name]) mapped[kind] = name;
  }
  const kinds = {};
  for (const [kind, name] of Object.entries(mapped)) {
    kinds[kind] = (el, r) => renderToString(e(StyleProvider, { cache }, e(antd.ConfigProvider, { theme }, components[name](el, r))));
  }
  return {
    name: 'antd',
    kinds, // kind → fn(el, r) → html, same contract as the bundled set
    mapped, // kind → antd component name, for the inspector
    styles: () => extractStyle(cache), // call after the last element has rendered
  };
}
