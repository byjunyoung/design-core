import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { loadProject } from './project.js';

// A comment is anchored to a screen and a YAML path — the same address the inspector shows —
// so the agent that reads it knows exactly which element the person meant. Comments live in
// <project>/.comments/<screen>.json: a file per screen, so they travel with the branch and
// the local viewer, the MCP server and a hosted viewer all read one store.

const dirOf = (dir) => join(dir, '.comments');
const fileOf = (dir, screen) => join(dirOf(dir), `${screen}.json`);
const newId = () => `c_${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;

async function read(dir, screen) {
  const f = fileOf(dir, screen);
  return existsSync(f) ? JSON.parse(await readFile(f, 'utf8')) : [];
}
async function write(dir, screen, list) {
  await mkdir(dirOf(dir), { recursive: true });
  await writeFile(fileOf(dir, screen), JSON.stringify(list, null, 2));
}

export async function addComment(dir, { screen, path, text, author, line = null }) {
  if (!screen || !text) throw new Error('a comment needs a screen and a text');
  const project = await loadProject(dir);
  if (!project.screens.some((s) => s.doc.screen === screen)) throw new Error(`no screen named "${screen}" in ${dir}`);
  const comment = { id: newId(), screen, path: path ?? '', line, text, author: author ?? 'anonymous', created: new Date().toISOString(), resolved: false };
  const list = await read(dir, screen);
  list.push(comment);
  await write(dir, screen, list);
  return comment;
}

export async function listComments(dir, { screen = null, status = 'open' } = {}) {
  const project = await loadProject(dir);
  const screens = screen ? [screen] : project.screens.map((s) => s.doc.screen);
  const all = [];
  for (const s of screens) all.push(...(await read(dir, s)));
  return all.filter((c) => status === 'all' || (status === 'open' ? !c.resolved : c.resolved)).sort((a, b) => a.created.localeCompare(b.created));
}

export async function resolveComment(dir, { id, by, note = '' }) {
  const project = await loadProject(dir);
  for (const s of project.screens) {
    const list = await read(dir, s.doc.screen);
    const c = list.find((x) => x.id === id);
    if (!c) continue;
    if (c.resolved) throw new Error(`comment "${id}" is already resolved`);
    Object.assign(c, { resolved: true, resolved_by: by ?? 'unknown', resolved_at: new Date().toISOString(), resolution: note });
    await write(dir, s.doc.screen, list);
    return c;
  }
  throw new Error(`no comment "${id}"`);
}
