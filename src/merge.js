import { findElement } from './elements.js';

// Default is the elements as written. Any other state is Default with its patches applied,
// in order. The merged view is computed here and never stored (DESIGN.md §3).
export function mergeState(screen, state) {
  const elements = structuredClone(screen.elements ?? []);
  const layout = structuredClone(screen.layout ?? {});
  const missingTargets = [];
  if (state === 'Default') return { state, elements, layout, missingTargets };

  for (const patch of screen.states?.[state] ?? []) {
    const hit = findElement(elements, patch.target);
    const hasLayoutKey = patch.target in layout;
    if (!hit && !hasLayoutKey) {
      missingTargets.push(patch.target);
      continue;
    }
    if (patch.hide) {
      if (hit) {
        const { container, key } = hit.parent;
        if (Array.isArray(container)) container.splice(key, 1);
        else delete container[key];
      }
      delete layout[patch.target];
      continue;
    }
    if (hit && patch.replace) hit.parent.container[hit.parent.key] = { id: patch.target, ...patch.replace };
    if (hit && patch.set) Object.assign(hit.el, patch.set);
    if (patch.layout) layout[patch.target] = { ...(layout[patch.target] ?? {}), ...patch.layout };
  }
  return { state, elements, layout, missingTargets };
}
