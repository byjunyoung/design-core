import React from 'react';
import { renderToString } from 'react-dom/server';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import createEmotionServer from '@emotion/server/create-instance';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import * as mui from '@mui/material';
import { h, v, isTbd, sample } from '../kinds.js';
import { DEFAULT_TOKENS, mergeTokens } from '../tokens.js';

// The second adapter, and the model for the next one: same contract as antd.js — a map of
// component names to renderers, a theme built from tokens, styles extracted after the last
// element rendered. MUI styles through emotion, so the cache is emotion's.

const e = React.createElement;
const list = (x) => (Array.isArray(x) ? x : x === undefined ? [] : [x]);
const text = (x) => (isTbd(x) ? `TBD${x.$tbd?.owner ? ` (${x.$tbd.owner})` : ''}` : x === undefined || x === null ? '' : String(x));
const label = (c) => (typeof c === 'object' && c && !isTbd(c) ? c.label ?? c.key ?? c.id ?? JSON.stringify(c) : c);
const raw = (html) => e('div', { dangerouslySetInnerHTML: { __html: html } });

function themeFrom(tokens) {
  const t = mergeTokens(DEFAULT_TOKENS, tokens);
  return createTheme({
    palette: { primary: { main: t.color.primary, contrastText: t.color['primary-text'] }, error: { main: t.color.danger }, text: { primary: t.color.text, secondary: t.color.muted }, divider: t.color.border, background: { paper: t.color.bg, default: t.color.surface } },
    shape: { borderRadius: parseInt(t.radius.md, 10) || 8 },
    typography: { fontFamily: t.font.family, fontSize: parseInt(t.font.size, 10) || 14 },
  });
}

const components = {
  Button: (el) => e(mui.Button, { variant: el.variant === 'primary' ? 'contained' : 'outlined', color: el.variant === 'danger' ? 'error' : 'primary', size: 'small', disabled: !!el.disabled || !!el.disabled_when }, text(el.label ?? el.title ?? el.id)),
  Table: (el) => {
    const cols = list(el.columns);
    return e(mui.Table, { size: 'small' },
      e(mui.TableHead, null, e(mui.TableRow, null, ...(el.selectable ? [e(mui.TableCell, { key: 'c', padding: 'checkbox' }, e(mui.Checkbox, { size: 'small' }))] : []), ...cols.map((c, i) => e(mui.TableCell, { key: i }, text(label(c)))))),
      e(mui.TableBody, null, ...Array.from({ length: 3 }, (_, r) => e(mui.TableRow, { key: r }, ...(el.selectable ? [e(mui.TableCell, { key: 'c', padding: 'checkbox' }, e(mui.Checkbox, { size: 'small' }))] : []), ...cols.map((c, i) => e(mui.TableCell, { key: i }, sample(c, r)))))),
    );
  },
  Pagination: (el) => e(mui.Pagination, { count: 5, page: 1, size: 'small' }),
  Alert: (el) => e(mui.Alert, { severity: el.kind === 'error-notice' || el.level === 'error' ? 'error' : 'info' }, text(el.text ?? el.title ?? '')),
  Skeleton: (el) => e('div', null, ...Array.from({ length: Math.min(Number(el.rows) || 3, 6) }, (_, i) => e(mui.Skeleton, { key: i, variant: 'text' }))),
  ToggleButtonGroup: (el) => e(mui.ToggleButtonGroup, { size: 'small', exclusive: true, value: text(list(el.options)[0]) }, ...list(el.options).map((o, i) => e(mui.ToggleButton, { key: i, value: text(o) }, text(o)))),
  TextField: (el) => e(mui.TextField, { size: 'small', fullWidth: true, select: el.kind === 'select', multiline: el.kind === 'textarea', type: el.kind === 'number' ? 'number' : 'text', placeholder: text(el.placeholder ?? el.format ?? ''), value: text(el.text ?? el.value ?? (el.kind === 'select' ? list(el.options)[0] : '') ?? ''), slotProps: { input: { readOnly: true } } }, ...(el.kind === 'select' ? list(el.options).map((o, i) => e(mui.MenuItem, { key: i, value: text(o) }, text(o))) : [])),
  RadioGroup: (el) => e(mui.RadioGroup, { row: true, value: text(list(el.options)[0]) }, ...list(el.options).map((o, i) => e(mui.FormControlLabel, { key: i, value: text(o), control: e(mui.Radio, { size: 'small' }), label: text(o) }))),
  Checkbox: (el) => e(mui.FormControlLabel, { control: e(mui.Checkbox, { size: 'small', checked: !!el.checked }), label: text(el.label ?? el.text ?? el.id) }),
  Switch: (el) => e(mui.Switch, { size: 'small', checked: !!el.on }),
  Chip: (el) => e(mui.Chip, { size: 'small', label: text(el.text ?? el.label ?? el.id) }),
  Divider: () => e(mui.Divider),
  Card: (el, r) => e(mui.Card, { variant: 'outlined' }, e(mui.CardContent, null, ...(el.title ? [e(mui.Typography, { variant: 'subtitle1', gutterBottom: true }, text(el.title))] : []), raw(r.children(el)))),
  Tooltip: (el) => e(mui.Chip, { size: 'small', variant: 'outlined', label: `ⓘ ${text(el.trigger ?? 'tooltip')}` }),
  CircularProgress: () => e('div', { style: { textAlign: 'center', padding: 16 } }, e(mui.CircularProgress, { size: 24 })),
  LinearProgress: () => e(mui.LinearProgress, { variant: 'determinate', value: 62 }),
};

export function create(project) {
  const cache = createCache({ key: 'dc' });
  const { extractCriticalToChunks, constructStyleTagsFromChunks } = createEmotionServer(cache);
  const theme = themeFrom(project.tokens);
  const mapped = {};
  for (const [kind, def] of Object.entries(project.conventions.kinds ?? {})) {
    const name = def?.maps_to?.mui;
    if (name && components[name]) mapped[kind] = name;
  }
  const kinds = {};
  const rendered = [];
  for (const [kind, name] of Object.entries(mapped)) {
    kinds[kind] = (el, r) => {
      const html = renderToString(e(CacheProvider, { value: cache }, e(ThemeProvider, { theme }, components[name](el, r))));
      rendered.push(html);
      return html;
    };
  }
  return {
    name: 'mui',
    kinds,
    mapped,
    styles: () => constructStyleTagsFromChunks(extractCriticalToChunks(rendered.join(''))),
  };
}
