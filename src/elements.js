// An element is any object with `id` and `kind`, wherever it sits: at the top level, under
// `children`, or inside an element-valued prop such as `actions` or `control`. Real screens
// nest (card → filter → button), so every lookup by id walks the whole tree.
const isElement = (v) => v && typeof v === 'object' && !Array.isArray(v) && typeof v.id === 'string' && typeof v.kind === 'string';

export function* walkElements(value, path = [], parent = null) {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* walkElements(value[i], [...path, i], { container: value, key: i });
    return;
  }
  if (isElement(value)) yield { el: value, path, parent };
  for (const [k, v] of Object.entries(value)) {
    if (k === '$tbd') continue;
    if (v && typeof v === 'object') yield* walkElements(v, [...path, k], { container: value, key: k });
  }
}

export function findElement(elements, id) {
  for (const hit of walkElements(elements, ['elements'])) if (hit.el.id === id) return hit;
  return null;
}

export const elementIds = (elements) => new Set([...walkElements(elements)].map((h) => h.el.id));
