// A render adapter draws mapped kinds with a real component library instead of the bundled
// set. It is chosen by name (`--components antd`) and resolved through each kind's
// `maps_to.<name>` in conventions.yaml, so a kind with no mapping keeps the bundled drawing.
// Adapters load lazily: the library is an optional dependency, and a project that never
// asks for it never pays for it.
const REGISTRY = {
  antd: () => import('./antd.js'),
};

export async function createAdapter(name, project) {
  const load = REGISTRY[name];
  if (!load) throw new Error(`no render adapter named "${name}" (have: ${Object.keys(REGISTRY).join(', ')})`);
  let mod;
  try {
    mod = await load();
  } catch (err) {
    throw new Error(`adapter "${name}" could not load its library — ${err.message}. Install it: npm install ${name}`);
  }
  return mod.create(project);
}

// What a project draws with, from its conventions: a project-owned module first (the
// self-built path — `render.components`), then a library named by `render.base`, else the
// bundled set. An explicit `--components` on the command line overrides all of it.
export async function resolveAdapter(project, override = null) {
  if (override) return createAdapter(override, project);
  const render = project.conventions.render ?? {};
  if (render.components) {
    const { pathToFileURL } = await import('node:url');
    const { resolve } = await import('node:path');
    const mod = await import(pathToFileURL(resolve(project.dir, render.components)).href);
    if (!mod.kinds) throw new Error(`${render.components} must export \`kinds\``);
    return { name: 'own', kinds: mod.kinds, styles: () => (mod.css ? `<style>${mod.css}</style>` : '') };
  }
  if (render.base && render.base !== 'none') return createAdapter(render.base, project);
  return null;
}
