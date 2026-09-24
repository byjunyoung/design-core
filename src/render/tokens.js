// The bundled token set: what a project gets when it ships no tokens. A project's resolved
// tokens (src/tokens.js — DTCG files or the flat tokens.json) are merged over it, leaf by
// leaf, so a team's `space.lg` wins. Every leaf reaches CSS as a custom property
// (`space.lg` → `--space-lg`, `color.bg.muted` → `--color-bg-muted`); nothing in the
// renderer writes a number with a unit.
export const DEFAULT_TOKENS = {
  space: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
  radius: { sm: '4px', md: '8px' },
  color: {
    bg: '#ffffff',
    surface: '#f7f7f8',
    border: '#d9dbe0',
    text: '#1f2328',
    muted: '#6b7280',
    primary: '#2f6fed',
    'primary-text': '#ffffff',
    danger: '#d1434b',
    placeholder: '#fafafb',
    'placeholder-border': '#b3b3bf',
    tbd: '#fff4d6',
    'tbd-border': '#e0b64a',
  },
  font: { family: 'system-ui, -apple-system, "Segoe UI", sans-serif', size: '14px' },
};

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

// Deep: a group merges into a group; a leaf (or a group over a leaf) replaces.
export function mergeTokens(base, extra) {
  const out = structuredClone(base);
  const walk = (into, from) => {
    for (const [k, v] of Object.entries(from ?? {})) {
      if (isObj(v) && isObj(into[k])) walk(into[k], v);
      else into[k] = isObj(v) ? structuredClone(v) : v;
    }
  };
  walk(out, extra);
  return out;
}

export const tokenVar = (name) => `var(--${String(name).replace(/\./g, '-')})`;

export function tokensToCss(tokens) {
  const lines = [];
  const walk = (obj, path) => {
    for (const [k, v] of Object.entries(obj ?? {})) {
      if (isObj(v)) walk(v, [...path, k]);
      else if (typeof v === 'string' || typeof v === 'number') lines.push(`  --${[...path, k].join('-')}: ${v};`);
    }
  };
  walk(tokens, []);
  return `:root {\n${lines.join('\n')}\n}`;
}
