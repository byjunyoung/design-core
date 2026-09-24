import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';

// Tokens as the project keeps them. Three shapes are read, in this order of precedence:
//
//   tokens/<name>.resolver.json   DTCG Resolver 2025.10 — sets, modifiers (light/dark…), resolutionOrder
//   tokens/*.tokens.json          DTCG Format 2025.10 files, merged in name order, one context
//   tokens.json                   the flat shape init wrote before 0.3: group → name → css string
//
// Whatever the shape, what comes out is the same: a nested object whose leaves are css strings,
// so `space.md` reaches CSS as `--space-md` and an adapter reads `t.color.primary` as it did.
// Primitives resolve along with everything else; whether a screen may name one is lint's job.
// Nothing here throws on a bad token — every miss is a problem with a path, for lint to show.

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const ALIAS = /^\{([^{}]+)\}$/;

// --- merge --------------------------------------------------------------------------------

// Later documents win token by token. A token (has $value) replaces whole; a group merges.
function deepMerge(into, from) {
  for (const [k, v] of Object.entries(from ?? {})) {
    if (isObj(v) && !('$value' in v) && isObj(into[k]) && !('$value' in into[k])) deepMerge(into[k], v);
    else into[k] = structuredClone(v);
  }
  return into;
}

// --- collect ------------------------------------------------------------------------------

// Walks a merged document and lists every token as { path, type, value }. A leaf that is a
// plain string or number (no $value) is an untyped token, so a flat-shaped file counts too.
// `$type` is inherited from the nearest group that sets one; `$extends` on a group pulls the
// referenced group's tokens in first, then the group's own.
function collect(doc, { path = [], type = null, out = [], root = doc, seen = new Set() } = {}) {
  if (isObj(doc) && '$value' in doc) {
    out.push({ path, type: doc.$type ?? type, value: doc.$value });
    return out;
  }
  if (!isObj(doc)) {
    if (path.length && (typeof doc === 'string' || typeof doc === 'number')) out.push({ path, type, value: doc });
    return out;
  }
  const groupType = doc.$type ?? type;
  if (typeof doc.$extends === 'string') {
    const m = ALIAS.exec(doc.$extends);
    const target = m && lookup(root, m[1].split('.'));
    const key = m?.[1];
    if (isObj(target) && !seen.has(key)) {
      const nested = new Set(seen);
      nested.add(key);
      collect(target, { path, type: groupType, out, root, seen: nested });
    }
  }
  for (const [k, v] of Object.entries(doc)) {
    if (k.startsWith('$')) continue;
    collect(v, { path: [...path, k], type: groupType, out, root, seen });
  }
  return out;
}

function lookup(doc, parts) {
  let cur = doc;
  for (const p of parts) {
    if (!isObj(cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

// --- values → css -------------------------------------------------------------------------

const hex2 = (n) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0');

function colorCss(v) {
  if (typeof v === 'string') return v;
  if (!isObj(v)) return null;
  const alpha = typeof v.alpha === 'number' && v.alpha < 1 ? hex2(v.alpha) : '';
  if (typeof v.hex === 'string') return v.hex.length === 7 ? v.hex + alpha : v.hex;
  const c = Array.isArray(v.components) ? v.components : null;
  if (!c) return null;
  if (!v.colorSpace || v.colorSpace === 'srgb') return `#${c.map(hex2).join('')}${alpha}`;
  return `color(${v.colorSpace} ${c.join(' ')}${alpha ? ` / ${v.alpha}` : ''})`;
}

function dimensionCss(v) {
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (isObj(v) && typeof v.value === 'number') return `${v.value}${v.unit ?? 'px'}`;
  return null;
}

const quoteFamily = (f) => (/[^\w-]/.test(f) && !/^["']/.test(f) ? `"${f}"` : f);

function toCss(type, v) {
  if (v === null || v === undefined) return null;
  switch (type) {
    case 'color':
      return colorCss(v);
    case 'dimension':
    case 'duration':
      return dimensionCss(v);
    case 'fontFamily':
      return Array.isArray(v) ? v.map(quoteFamily).join(', ') : quoteFamily(String(v));
    case 'fontWeight':
    case 'number':
      return String(v);
    case 'cubicBezier':
      return Array.isArray(v) ? `cubic-bezier(${v.join(', ')})` : null;
    case 'shadow': {
      const one = (s) => (isObj(s) ? [dimensionCss(s.offsetX), dimensionCss(s.offsetY), dimensionCss(s.blur), dimensionCss(s.spread), colorCss(s.color)].filter(Boolean).join(' ') + (s.inset ? ' inset' : '') : null);
      return Array.isArray(v) ? v.map(one).filter(Boolean).join(', ') : one(v);
    }
    case 'strokeStyle':
      return typeof v === 'string' ? v : null;
    default:
      // untyped, or a composite (border, typography, gradient, transition) that is not one css value
      return typeof v === 'string' || typeof v === 'number' ? String(v) : null;
  }
}

// --- resolve ------------------------------------------------------------------------------

// Aliases are `{group.token}`, whole-value or inside a composite. Cycles and misses become problems.
function deref(value, byName, problems, at, stack) {
  if (typeof value === 'string') {
    const m = ALIAS.exec(value);
    if (!m) return value;
    const name = m[1];
    if (stack.includes(name)) {
      problems.push({ path: at, message: `alias cycle: ${[...stack, name].join(' → ')}` });
      return undefined;
    }
    const target = byName.get(name);
    if (!target) {
      problems.push({ path: at, message: `alias {${name}} names no token` });
      return undefined;
    }
    return deref(target.value, byName, problems, at, [...stack, name]);
  }
  if (Array.isArray(value)) return value.map((x) => deref(x, byName, problems, at, stack));
  if (isObj(value)) return Object.fromEntries(Object.entries(value).map(([k, x]) => [k, deref(x, byName, problems, at, stack)]));
  return value;
}

function setIn(obj, path, value) {
  let cur = obj;
  for (const p of path.slice(0, -1)) {
    if (!isObj(cur[p])) cur[p] = {};
    cur = cur[p];
  }
  cur[path[path.length - 1]] = value;
}

// `docs` are token documents, or `{ doc, file }` so every token remembers which file last
// defined it (`origins`) — that is how lint tells a primitive from a semantic token.
export function resolveTokens(docs) {
  const merged = {};
  const origins = {};
  for (const item of docs) {
    const doc = item && typeof item === 'object' && 'doc' in item ? item.doc : item;
    const file = item && typeof item === 'object' && 'file' in item ? item.file : null;
    deepMerge(merged, doc);
    for (const e of collect(doc)) origins[e.path.join('.')] = file;
  }
  const entries = collect(merged);
  const byName = new Map(entries.map((e) => [e.path.join('.'), e]));
  const problems = [];
  const tokens = {};
  const raw = {};
  for (const e of entries) {
    const at = e.path.join('.');
    const type = e.type ?? (typeof e.value === 'string' && ALIAS.test(e.value) ? byName.get(ALIAS.exec(e.value)[1])?.type : null) ?? null;
    const before = problems.length;
    const value = deref(e.value, byName, problems, at, [at]);
    for (let i = before; i < problems.length; i++) problems[i] = { severity: 'blocking', file: origins[at] ?? null, ...problems[i] };
    if (value === undefined) continue;
    setIn(raw, e.path, value);
    const css = toCss(type, value);
    if (css !== null) setIn(tokens, e.path, css);
  }
  return { tokens, raw, origins, problems };
}

// Every dotted token name in a resolved set.
export function tokenNames(tokens, path = [], out = []) {
  for (const [k, v] of Object.entries(tokens ?? {})) {
    if (isObj(v)) tokenNames(v, [...path, k], out);
    else out.push([...path, k].join('.'));
  }
  return out;
}

export function getToken(tokens, name) {
  const v = lookup(tokens, String(name).split('.'));
  return isObj(v) ? undefined : v;
}

export function hasToken(tokens, name) {
  return getToken(tokens, name) !== undefined;
}

// --- resolver document --------------------------------------------------------------------

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

// A source is `{ $ref: "file.json" }` (relative to the resolver) or an inline token document.
async function sourcesToDocs(sources, base, problems, where, resolverFile) {
  const docs = [];
  for (const s of Array.isArray(sources) ? sources : []) {
    if (isObj(s) && typeof s.$ref === 'string') {
      const file = resolve(base, s.$ref);
      try {
        docs.push({ doc: await readJson(file), file });
      } catch (err) {
        problems.push({ severity: 'blocking', file: resolverFile, path: where, message: `cannot read ${s.$ref}: ${err.code ?? err.message}` });
      }
    } else if (isObj(s)) docs.push({ doc: s, file: resolverFile });
  }
  return docs;
}

// A semantic token that one context defines and another does not would render as nothing in
// the second — the viewer would show a hole where a colour should be. Reported per token.
function contextGaps(name, contexts, file) {
  const all = new Set(Object.values(contexts).flatMap((t) => tokenNames(t)));
  const out = [];
  for (const [ctx, t] of Object.entries(contexts))
    for (const n of all) if (!hasToken(t, n)) out.push({ severity: 'blocking', file, path: n, context: `${name}=${ctx}`, message: `token "${n}" has no value in ${name}=${ctx}` });
  return out;
}

const pointer = (ref) => (typeof ref === 'string' && ref.startsWith('#/') ? ref.slice(2).split('/') : null);

async function evaluateResolver(doc, file) {
  const base = dirname(file);
  const problems = [];
  const sets = {};
  for (const [name, set] of Object.entries(doc.sets ?? {})) sets[name] = await sourcesToDocs(set?.sources, base, problems, `sets.${name}`, file);
  const modifiers = {};
  for (const [name, mod] of Object.entries(doc.modifiers ?? {})) {
    const contexts = {};
    for (const [ctx, sources] of Object.entries(mod?.contexts ?? {})) contexts[ctx] = await sourcesToDocs(sources, base, problems, `modifiers.${name}.${ctx}`, file);
    const names = Object.keys(contexts);
    if (mod?.default && !names.includes(mod.default)) problems.push({ severity: 'blocking', file, path: `modifiers.${name}.default`, message: `default "${mod.default}" is not a context of ${name}` });
    modifiers[name] = { contexts, default: names.includes(mod?.default) ? mod.default : names[0] };
  }
  const order = [];
  for (const item of Array.isArray(doc.resolutionOrder) ? doc.resolutionOrder : []) {
    const p = pointer(item?.$ref);
    if (p?.[0] === 'sets' && sets[p[1]]) order.push({ set: p[1] });
    else if (p?.[0] === 'modifiers' && modifiers[p[1]]) order.push({ modifier: p[1] });
    else problems.push({ severity: 'blocking', file, path: 'resolutionOrder', message: `${item?.$ref ?? JSON.stringify(item)} is not a set or a modifier` });
  }
  const defaults = Object.fromEntries(Object.entries(modifiers).map(([n, m]) => [n, m.default]));
  const docsFor = (input) =>
    order.flatMap((step) => (step.set ? sets[step.set] : modifiers[step.modifier].contexts[input[step.modifier] ?? modifiers[step.modifier].default] ?? []));
  const evaluate = (input) => resolveTokens(docsFor({ ...defaults, ...input }));
  const contexts = {};
  for (const [name, m] of Object.entries(modifiers)) {
    contexts[name] = {};
    for (const ctx of Object.keys(m.contexts)) {
      const r = evaluate({ [name]: ctx });
      contexts[name][ctx] = r.tokens;
      if (ctx !== m.default) for (const p of r.problems) problems.push({ ...p, context: `${name}=${ctx}` });
    }
    problems.push(...contextGaps(name, contexts[name], file));
  }
  const main = evaluate({});
  return { tokens: main.tokens, raw: main.raw, origins: main.origins, defaults, contexts, problems: [...main.problems, ...problems] };
}

// --- the bundled set, as files ------------------------------------------------------------

// What init writes into tokens/. Two tiers: primitive.tokens.json is the palette and the scale,
// the rest name those by alias. Spacing, radius and type sit in one set for every context;
// colour is what a theme changes, so light and dark each carry only colour. Resolved for
// light this is exactly DEFAULT_TOKENS, which is what a project with no tokens renders with.
const srgb = (hex) => ({ colorSpace: 'srgb', components: [1, 3, 5].map((i) => Math.round((parseInt(hex.slice(i, i + 2), 16) / 255) * 1000) / 1000), hex });
const color = (hex) => ({ $value: srgb(hex) });
const px = (n) => ({ $value: { value: n, unit: 'px' } });
const alias = (name) => ({ $value: `{${name}}` });

export const DEFAULT_TOKEN_FILES = {
  'primitive.tokens.json': {
    $description: 'Primitives: the palette and the scale. A screen never names these; the semantic files below do.',
    gray: { $type: 'color', 0: color('#ffffff'), 50: color('#fafafb'), 100: color('#f7f7f8'), 200: color('#d9dbe0'), 400: color('#b3b3bf'), 500: color('#6b7280'), 700: color('#3a4048'), 800: color('#2a2f36'), 900: color('#1f2328') },
    blue: { $type: 'color', 400: color('#5b8dff'), 500: color('#2f6fed') },
    red: { $type: 'color', 400: color('#e0616a'), 500: color('#d1434b') },
    yellow: { $type: 'color', 100: color('#fff4d6'), 500: color('#e0b64a'), 900: color('#4a3d14') },
    size: { $type: 'dimension', 1: px(4), 2: px(8), 4: px(16), 6: px(24), 8: px(32) },
    type: { sans: { $type: 'fontFamily', $value: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] }, base: { $type: 'dimension', $value: { value: 14, unit: 'px' } } },
  },
  'semantic.tokens.json': {
    $description: 'Semantic tokens that do not change with the theme: spacing, radius, type. Screens name these.',
    space: { $type: 'dimension', xs: alias('size.1'), sm: alias('size.2'), md: alias('size.4'), lg: alias('size.6'), xl: alias('size.8') },
    radius: { $type: 'dimension', sm: alias('size.1'), md: alias('size.2') },
    font: { family: { $type: 'fontFamily', ...alias('type.sans') }, size: { $type: 'dimension', ...alias('type.base') } },
  },
  'light.tokens.json': {
    $description: 'Colour in the light theme.',
    color: {
      $type: 'color',
      bg: alias('gray.0'),
      surface: alias('gray.100'),
      border: alias('gray.200'),
      text: alias('gray.900'),
      muted: alias('gray.500'),
      primary: alias('blue.500'),
      'primary-text': alias('gray.0'),
      danger: alias('red.500'),
      placeholder: alias('gray.50'),
      'placeholder-border': alias('gray.400'),
      tbd: alias('yellow.100'),
      'tbd-border': alias('yellow.500'),
    },
  },
  'dark.tokens.json': {
    $description: 'Colour in the dark theme. A starting point, not a design decision — tune it.',
    color: {
      $type: 'color',
      bg: alias('gray.900'),
      surface: alias('gray.800'),
      border: alias('gray.700'),
      text: alias('gray.0'),
      muted: alias('gray.400'),
      primary: alias('blue.400'),
      'primary-text': alias('gray.0'),
      danger: alias('red.400'),
      placeholder: alias('gray.800'),
      'placeholder-border': alias('gray.700'),
      tbd: alias('yellow.900'),
      'tbd-border': alias('yellow.500'),
    },
  },
  'theme.resolver.json': {
    name: 'theme',
    version: '2025.10',
    description: 'How the token files combine: primitives and the fixed semantic set first, then the colour of the chosen theme.',
    sets: { base: { sources: [{ $ref: 'primitive.tokens.json' }, { $ref: 'semantic.tokens.json' }] } },
    modifiers: { theme: { contexts: { light: [{ $ref: 'light.tokens.json' }], dark: [{ $ref: 'dark.tokens.json' }] }, default: 'light' } },
    resolutionOrder: [{ $ref: '#/sets/base' }, { $ref: '#/modifiers/theme' }],
  },
};

// --- entry --------------------------------------------------------------------------------

export async function loadTokens(dir) {
  const files = [];
  const problems = [];
  let names = [];
  try {
    names = (await readdir(join(dir, 'tokens'))).sort();
  } catch {
    names = [];
  }
  const resolverName = names.find((n) => n.endsWith('.resolver.json'));
  const tokenFiles = names.filter((n) => n.endsWith('.tokens.json'));
  let flat = null;
  try {
    flat = await readJson(join(dir, 'tokens.json'));
  } catch {
    flat = null;
  }

  const flatFile = join(dir, 'tokens.json');
  const ignored = () => problems.push({ severity: 'warning', file: flatFile, path: 'tokens.json', message: 'tokens.json ignored: tokens/ takes precedence' });

  if (resolverName) {
    const file = join(dir, 'tokens', resolverName);
    files.push(file);
    if (flat) ignored();
    try {
      const r = await evaluateResolver(await readJson(file), file);
      return { source: 'dtcg', resolver: resolverName, files, ...r, problems: [...problems, ...r.problems] };
    } catch (err) {
      problems.push({ severity: 'blocking', file, path: resolverName, message: `cannot read resolver: ${err.message}` });
    }
  }
  if (tokenFiles.length) {
    if (flat) ignored();
    const docs = [];
    for (const n of tokenFiles) {
      const file = join(dir, 'tokens', n);
      files.push(file);
      try {
        docs.push({ doc: await readJson(file), file });
      } catch (err) {
        problems.push({ severity: 'blocking', file, path: n, message: `cannot read ${n}: ${err.message}` });
      }
    }
    const r = resolveTokens(docs);
    return { source: 'dtcg', resolver: null, files, tokens: r.tokens, raw: r.raw, origins: r.origins, defaults: {}, contexts: {}, problems: [...problems, ...r.problems] };
  }
  if (flat) {
    files.push(flatFile);
    return { source: 'flat', resolver: null, files, tokens: flat, raw: flat, origins: {}, defaults: {}, contexts: {}, problems };
  }
  return { source: 'none', resolver: null, files, tokens: null, raw: null, origins: {}, defaults: {}, contexts: {}, problems };
}
