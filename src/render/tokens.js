// The bundled token set: what a project gets when it ships no tokens.json. A project's
// tokens.json is merged over it, key by key, so a team's `space.lg` wins. Every value
// reaches CSS as a custom property (`space.lg` → `--space-lg`); nothing in the renderer
// writes a number with a unit.
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

export function mergeTokens(base, extra) {
  const out = structuredClone(base);
  for (const [group, values] of Object.entries(extra ?? {})) {
    if (values && typeof values === 'object' && !Array.isArray(values)) out[group] = { ...(out[group] ?? {}), ...values };
  }
  return out;
}

export const tokenVar = (name) => `var(--${String(name).replace(/\./g, '-')})`;

export function tokensToCss(tokens) {
  const lines = [];
  for (const [group, values] of Object.entries(tokens))
    for (const [k, v] of Object.entries(values)) lines.push(`  --${group}-${k}: ${v};`);
  return `:root {\n${lines.join('\n')}\n}`;
}
