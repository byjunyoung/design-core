import { readdir, stat } from 'node:fs/promises';
import { join, resolve, sep, extname } from 'node:path';
import { walkElements } from './elements.js';

// Assets are files under <design>/assets/ — icons, photos, illustrations — that a screen names
// by path: `src: assets/photos/menu.jpg` on an image, `icon: assets/icons/cart.svg` on any
// kind with an icon. Anything else in `icon` stays a glyph. The files are the person's; the
// tool reads them, serves them and says which screen uses which (DESIGN.md §4.6).
export const ASSET_TYPES = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif' };
const EXT = new RegExp(`\\.(${Object.keys(ASSET_TYPES).join('|')})$`, 'i');

export const isAssetRef = (v) => typeof v === 'string' && /^assets\/\S+$/.test(v) && EXT.test(v);
export const assetType = (p) => ASSET_TYPES[extname(String(p)).slice(1).toLowerCase()] ?? 'application/octet-stream';

// Every asset file, recursively, as `assets/<path>` with its size. No folder is fine: [].
export async function loadAssets(dir) {
  const root = join(dir, 'assets');
  let names;
  try {
    names = await readdir(root, { recursive: true });
  } catch {
    return [];
  }
  const out = [];
  for (const n of names.sort()) {
    if (!EXT.test(n)) continue;
    const file = join(root, n);
    const s = await stat(file);
    if (!s.isFile()) continue;
    out.push({ path: `assets/${n.split(sep).join('/')}`, file, bytes: s.size, type: assetType(n) });
  }
  return out;
}

// The file a served /assets/… URL means, or null when the path would leave the folder.
export function assetFile(dir, urlPath) {
  const root = resolve(dir, 'assets');
  let clean;
  try {
    clean = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const target = resolve(dir, clean.replace(/^\/+/, ''));
  return target.startsWith(root + sep) ? target : null;
}

// Every place a screen or a contract names an asset: Default elements, state and variant
// patches (`set` and `replace`), a contract's own elements and its sample.
export function assetRefs(project) {
  const refs = [];
  const take = (obj, path, where) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of ['src', 'icon']) if (isAssetRef(obj[key])) refs.push({ ...where, path: obj[key], at: [...path, key] });
  };
  for (const s of project.screens ?? []) {
    const where = { screen: s.doc.screen, file: s.file };
    for (const hit of walkElements(s.doc.elements ?? [], ['elements'])) take(hit.el, hit.path, where);
    const lists = [
      ...Object.entries(s.doc.states ?? {}).map(([k, v]) => [['states', k], v]),
      ...Object.entries(s.doc.variants ?? {}).flatMap(([axis, opts]) => Object.entries(opts ?? {}).map(([o, v]) => [['variants', axis, o], v])),
    ];
    for (const [base, list] of lists)
      (Array.isArray(list) ? list : []).forEach((p, i) => {
        take(p?.set, [...base, i, 'set'], where);
        take(p?.replace, [...base, i, 'replace'], where);
        for (const hit of walkElements(p?.replace ?? {}, [...base, i, 'replace'])) take(hit.el, hit.path, where);
      });
  }
  for (const c of Object.values(project.components ?? {})) {
    const where = { component: c.kind, file: c.file ?? null };
    take(c.sample, ['sample'], where);
    for (const hit of walkElements(c.elements ?? [], ['elements'])) take(hit.el, hit.path, where);
  }
  return refs;
}

// The assets page and `doan assets`: every file with who uses it, the references that name
// no file, and the files nothing names.
export function assetsSummary(project) {
  const byPath = new Map((project.assets ?? []).map((a) => [a.path, { ...a, usedBy: [] }]));
  const missing = [];
  for (const r of assetRefs(project)) {
    const a = byPath.get(r.path);
    if (a) a.usedBy.push(r);
    else missing.push(r);
  }
  const assets = [...byPath.values()];
  return { assets, missing, unused: assets.filter((a) => !a.usedBy.length).map((a) => a.path) };
}
