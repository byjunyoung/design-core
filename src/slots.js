// The slots a contract may bind a token to, and the CSS property each one is in the picture.
// Seven since 0.4 — colour, radius, spacing — and four since 0.12: type size and weight, the
// minimum height of a control, shadow. The last four are what a kiosk needs to look like a
// kiosk rather than an admin page: big type and tall touch targets (DESIGN.md §4.5).
//
// A binding becomes `--k-<kind>-<slot>` on the element's wrapper (src/render/index.js
// componentCss). The bundled set reads those variables itself, with the value it drew before
// contracts existed as the fallback; a root an adapter drew (antd, MUI) gets them applied from
// outside, property by property, through this table. L28 warns on a slot not listed here —
// a typo would otherwise be ignored without a word.
export const SLOT_CSS = {
  bg: 'background-color',
  text: 'color',
  border: 'border-color',
  radius: 'border-radius',
  padding: 'padding',
  gap: 'gap',
  accent: 'accent-color',
  'font-size': 'font-size',
  'font-weight': 'font-weight',
  'min-height': 'min-height',
  shadow: 'box-shadow',
};

// `muted` is a second text colour eleven bundled kinds read for their small print (--k-<kind>-muted);
// it is no one css property, so an adapter root does not take it from outside.
export const SLOTS = [...Object.keys(SLOT_CSS), 'muted'];
