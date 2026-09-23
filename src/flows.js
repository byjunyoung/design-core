// A flow target is `screen` or `screen.State`. The split is on the last dot, which is
// only safe because conventions.naming.screen_pattern forbids '.' in a screen name —
// loosen that pattern and this must change with it.
export function resolveFlowTarget(target, screens) {
  const byName = (name) => screens.find((s) => s.doc.screen === name);
  const direct = byName(target);
  if (direct) return { screen: target, state: null };
  const dot = target.lastIndexOf('.');
  if (dot === -1) return null;
  const screen = target.slice(0, dot);
  const state = target.slice(dot + 1);
  const found = byName(screen);
  if (!found) return null;
  if (state === 'Default' || found.doc.states?.[state]) return { screen, state };
  return null;
}
