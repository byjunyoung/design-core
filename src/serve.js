import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadProject } from './project.js';
import { renderScreen, renderIndex, renderProposal, renderLibrary, renderProto, renderCanvas, renderTokens, renderAssets } from './render/index.js';
import { canvasPages } from './canvas.js';
import { assetFile, assetType } from './assets.js';
import { resolveAdapter } from './render/adapters/index.js';
import { lintProject, currentBranch } from './verbs.js';
import { listProposals, applyProposal, rejectProposal } from './proposals.js';
import { addComment, listComments, resolveComment } from './comments.js';

// The local viewer: the same pages `render` writes, served live from the files, plus the
// three things a static page cannot do — take a comment, apply or reject a proposal, and
// answer a bot. It is the seed of the hosted service (DESIGN.md §10): put this behind a URL
// per branch and the layer table there is what you get.

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};
const html = (res, body) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
};
const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(new Error('body is not JSON'));
      }
    });
  });

export async function startServer(dir, { port = 4870, host = '127.0.0.1', branch = null, today = null, components = null } = {}) {
  const opts = { branch: branch ?? currentBranch(dir), today: today ?? new Date().toISOString().slice(0, 10) };

  async function handle(req, res) {
    const url = new URL(req.url, `http://${host}`);
    const path = url.pathname;
    try {
      if (path.startsWith('/api/')) return await api(req, res, url);
      // the person's asset files, straight from assets/ — never a path outside it
      if (path.startsWith('/assets/')) {
        const file = assetFile(dir, path);
        if (!file) return json(res, 404, { error: 'not found' });
        try {
          const body = await readFile(file);
          res.writeHead(200, { 'content-type': assetType(file), 'cache-control': 'no-cache' });
          return res.end(body);
        } catch {
          return json(res, 404, { error: 'not found' });
        }
      }
      const project = await loadProject(dir);
      const adapter = await resolveAdapter(project, components);
      if (path === '/' || path === '/index.html') {
        const pending = await listProposals(dir, { status: 'pending' });
        const open = await listComments(dir);
        return html(res, await renderIndex(project, { ...opts, adapter, proposals: pending, comments: open, api: true }));
      }
      if (path === '/tokens.html') return html(res, renderTokens(project, { branch: opts.branch, api: true }));
      if (path === '/assets.html') return html(res, renderAssets(project, { branch: opts.branch, api: true }));
      if (path === '/components.html') return html(res, renderLibrary(project, { branch: opts.branch, adapter, api: true }));
      if (path === '/proto.html') return html(res, renderProto(project, { branch: opts.branch, adapter, api: true }));
      let m = path.match(/^\/canvas-(.+)\.html$/);
      if (m) {
        const spec = canvasPages(project).find((p) => p.slug === decodeURIComponent(m[1]));
        if (!spec) return json(res, 404, { error: `no domain "${m[1]}"` });
        return html(res, renderCanvas(project, spec, { branch: opts.branch, adapter, api: true, comments: await listComments(dir, { status: 'open' }) }));
      }
      m = path.match(/^\/proposal-(p_[a-z0-9]+)\.html$/);
      if (m) {
        const full = JSON.parse(await readFile(join(dir, '.proposals', `${m[1]}.json`), 'utf8'));
        return html(res, renderProposal(project, full, { branch: opts.branch, adapter, api: true }));
      }
      m = path.match(/^\/(.+)\.html$/);
      if (m) {
        const screen = project.screens.find((s) => s.doc.screen === decodeURIComponent(m[1]));
        if (!screen) return json(res, 404, { error: `no screen "${m[1]}"` });
        const comments = await listComments(dir, { screen: screen.doc.screen });
        return html(res, renderScreen(project, screen, { branch: opts.branch, adapter, api: true, comments }));
      }
      return json(res, 404, { error: 'not found' });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  async function api(req, res, url) {
    const path = url.pathname;
    const method = req.method;
    let m;
    try {
      if (method === 'GET' && path === '/api/lint') return json(res, 200, await lintProject(dir, { ...opts, cwd: dir }));
      if (method === 'GET' && path === '/api/proposals') return json(res, 200, { proposals: await listProposals(dir, { status: url.searchParams.get('status') ?? 'pending' }) });
      if (method === 'GET' && path === '/api/comments') return json(res, 200, { comments: await listComments(dir, { screen: url.searchParams.get('screen'), status: url.searchParams.get('status') ?? 'open' }) });
      if (method === 'POST' && path === '/api/comments') return json(res, 201, await addComment(dir, await readBody(req)));
      if (method === 'POST' && (m = path.match(/^\/api\/comments\/(c_[a-z0-9]+)\/resolve$/))) return json(res, 200, await resolveComment(dir, { id: m[1], ...(await readBody(req)) }));
      if (method === 'POST' && (m = path.match(/^\/api\/proposals\/(p_[a-z0-9]+)\/apply$/))) {
        const body = await readBody(req);
        if (!body.by) return json(res, 400, { error: 'apply needs "by": the person who said yes' });
        return json(res, 200, await applyProposal(dir, { id: m[1], approved_by: body.by }));
      }
      if (method === 'POST' && (m = path.match(/^\/api\/proposals\/(p_[a-z0-9]+)\/reject$/))) return json(res, 200, await rejectProposal(dir, { id: m[1], ...(await readBody(req)) }));
      return json(res, 404, { error: 'no such api' });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  const server = createServer(handle);
  await new Promise((resolve) => server.listen(port, host, resolve));
  const actual = server.address().port;
  return { port: actual, url: `http://${host}:${actual}/`, close: () => new Promise((r) => server.close(r)) };
}
