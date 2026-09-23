// Default is the elements as written. Any other state is Default with its patches applied,
// in order. The merged view is computed here and never stored (DESIGN.md §3).
export function mergeState(screen, state) {
  const elements = structuredClone(screen.elements ?? []);
  const layout = structuredClone(screen.layout ?? {});
  const missingTargets = [];
  if (state === 'Default') return { state, elements, layout, missingTargets };

  for (const patch of screen.states?.[state] ?? []) {
    const index = elements.findIndex((e) => e.id === patch.target);
    const hasLayoutKey = patch.target in layout;
    if (index === -1 && !hasLayoutKey) {
      missingTargets.push(patch.target);
      continue;
    }
    if (patch.hide) {
      if (index !== -1) elements.splice(index, 1);
      delete layout[patch.target];
      continue;
    }
    if (patch.replace && index !== -1) elements[index] = { id: patch.target, ...patch.replace };
    if (patch.set && index !== -1) Object.assign(elements[index], patch.set);
    if (patch.layout) layout[patch.target] = { ...(layout[patch.target] ?? {}), ...patch.layout };
  }
  return { state, elements, layout, missingTargets };
}
