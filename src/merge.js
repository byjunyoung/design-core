import { findElement } from './elements.js';

function applyPatches(patches, elements, layout, missingTargets) {
  for (const patch of patches) {
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
}

// Default is the elements as written. A view is Default, then the chosen option of each
// variant axis in the order the axes are declared, then the state's patches. Variants are
// what a screen *is* for this record or mode (an edit modal for a counted item, a dialog in
// Edit mode); states are what it is *doing* (Empty, Loading). The merged view is computed
// here and never stored (DESIGN.md §3).
export function mergeState(screen, state, variants = {}) {
  const elements = structuredClone(screen.elements ?? []);
  const layout = structuredClone(screen.layout ?? {});
  const missingTargets = [];

  for (const [axis, options] of Object.entries(screen.variants ?? {})) {
    const chosen = variants[axis];
    if (chosen === undefined) continue;
    applyPatches(options[chosen] ?? [], elements, layout, missingTargets);
  }
  if (state !== 'Default') applyPatches(screen.states?.[state] ?? [], elements, layout, missingTargets);

  return { state, variants, elements, layout, missingTargets };
}
