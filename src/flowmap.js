import { resolveFlowTarget } from './flows.js';
import { platformOf } from './render/index.js';

// The flow map: every screen of the product on one page, laid out from its flows. A screen is
// a node — a thumbnail of Default with one row per state under it — and a flow is an edge
// that lands on the row it names, so `kiosk-menu.Selected` arrives at "Selected" and nowhere
// else. Sections are boxes around their screens. Nothing here is stored: the files hold flows,
// the layout is computed at render time by ELK (the layered algorithm, orthogonal routing,
// fixed ports — what `fig:arrows` drew by hand on a canvas). ELK is an optional dependency;
// without it the page says so and the rest of the viewer is untouched.

// Node geometry, in page pixels. The thumbnail keeps the platform's proportions.
const HEAD = 26;
const ROW = 18;
const PAD = 8;
const THUMB = { web: { w: 240, h: 150 }, tablet: { w: 200, h: 150 }, phone: { w: 120, h: 260 } };

export function nodeGeometry(project, screen, states) {
  const platform = platformOf(project, screen);
  const kind = platform.frame === 'phone' ? 'phone' : platform.frame === 'tablet' ? 'tablet' : 'web';
  const t = THUMB[kind];
  const scale = t.w / platform.width;
  const thumb = { w: t.w, h: platform.height ? Math.round(platform.height * scale) : t.h, scale, refW: platform.width, refH: platform.height };
  const w = Math.max(thumb.w, 200) + PAD * 2;
  const rows = states.map((name, i) => ({ name, y: PAD + HEAD + thumb.h + 6 + i * ROW }));
  const h = PAD + HEAD + thumb.h + 6 + states.length * ROW + PAD;
  return { w, h, thumb, rows, head: PAD, platform: platform.name };
}

const label = (flow) => [flow.from + (flow.via ? `.${flow.via}` : ''), flow.gesture, flow.nav, flow.when].filter(Boolean).join(' · ');
const textWidth = (s) => Math.round(String(s).length * 6.2) + 8;

// What the page needs before any layout: the edges that resolve, the ones that do not, and
// the screens no flow touches. This is also what `list_flows` returns.
export function flowGraph(project) {
  const states = (s) => {
    const known = project.conventions.states?.known ?? [];
    const present = Object.keys(s.doc.states ?? {});
    return ['Default', ...known.filter((x) => x !== 'Default' && present.includes(x)), ...present.filter((x) => !known.includes(x))];
  };
  const edges = [];
  const dead = [];
  const touched = new Set();
  for (const s of project.screens)
    (s.doc.flows ?? []).forEach((flow, i) => {
      const target = resolveFlowTarget(flow.to, project.screens);
      const base = { id: `${s.doc.screen}#${i}`, screen: s.doc.screen, from: flow.from, via: flow.via ?? null, to: flow.to, gesture: flow.gesture ?? null, nav: flow.nav ?? null, when: flow.when ?? null, style: flow.style ?? 'default', label: label(flow) };
      if (!target) {
        dead.push(base);
        return;
      }
      edges.push({ ...base, target: target.screen, state: target.state ?? 'Default' });
      touched.add(s.doc.screen);
      touched.add(target.screen);
    });
  const nodes = project.screens.map((s) => ({ screen: s.doc.screen, section: s.doc.section, type: s.doc.type, states: states(s) }));
  const orphans = nodes.filter((n) => !touched.has(n.screen)).map((n) => n.screen);
  return { nodes, edges, dead, orphans };
}

async function loadElk() {
  try {
    const mod = await import('elkjs/lib/elk.bundled.js');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

// ELK gives each node's position relative to its parent and each edge's points relative to
// the node named `container` (the source and target's common ancestor). Everything below is
// turned into page coordinates once, here, so the page just draws.
export async function layoutFlows(project, { elk: elkModule = undefined } = {}) {
  const graph = flowGraph(project);
  const ELK = elkModule === undefined ? await loadElk() : elkModule;
  if (!ELK) return { ok: false, reason: 'elkjs is not installed — npm install elkjs — the flow map needs it; everything else does not', ...graph };

  const geometry = {};
  const bySection = {};
  for (const s of project.screens) {
    const node = graph.nodes.find((n) => n.screen === s.doc.screen);
    geometry[s.doc.screen] = nodeGeometry(project, s, node.states);
    (bySection[s.doc.section] ??= []).push(s.doc.screen);
  }
  const sectionOrder = [...project.sections.filter((x) => bySection[x]), ...Object.keys(bySection).filter((x) => !project.sections.includes(x))];
  const secId = (name) => `sec::${name}`;
  const inPort = (screen, state) => `${screen}::in::${state}`;
  const outPort = (screen) => `${screen}::out`;

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.spacing.nodeNode': '40',
      'elk.spacing.edgeNode': '24',
      'elk.layered.spacing.edgeNodeBetweenLayers': '24',
      'elk.spacing.edgeLabel': '6',
      'elk.spacing.componentComponent': '60',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
    },
    children: sectionOrder.map((section) => ({
      id: secId(section),
      layoutOptions: { 'elk.padding': '[top=40,left=20,bottom=20,right=20]', 'elk.spacing.nodeNode': '40', 'elk.layered.spacing.nodeNodeBetweenLayers': '90' },
      children: bySection[section].map((screen) => {
        const g = geometry[screen];
        return {
          id: screen,
          width: g.w,
          height: g.h,
          layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
          ports: [
            ...g.rows.map((r) => ({ id: inPort(screen, r.name), x: 0, y: r.y + ROW / 2, width: 1, height: 1 })),
            { id: outPort(screen), x: g.w, y: g.head + HEAD + g.thumb.h / 2, width: 1, height: 1 },
          ],
        };
      }),
    })),
    edges: graph.edges.map((e) => ({
      id: e.id,
      sources: [outPort(e.screen)],
      targets: [inPort(e.target, e.state)],
      labels: e.label ? [{ text: e.label, width: textWidth(e.label), height: 14 }] : [],
    })),
  };

  const laid = await new ELK().layout(elkGraph);

  // absolute positions
  const abs = { root: { x: 0, y: 0 } };
  const sections = [];
  const nodes = [];
  for (const sec of laid.children ?? []) {
    abs[sec.id] = { x: sec.x, y: sec.y };
    sections.push({ id: sec.id, title: sec.id.slice('sec::'.length), x: sec.x, y: sec.y, w: sec.width, h: sec.height });
    for (const n of sec.children ?? []) {
      abs[n.id] = { x: sec.x + n.x, y: sec.y + n.y };
      const g = geometry[n.id];
      nodes.push({ screen: n.id, section: sec.id.slice('sec::'.length), x: sec.x + n.x, y: sec.y + n.y, w: g.w, h: g.h, thumb: g.thumb, rows: g.rows, head: g.head, platform: g.platform, type: graph.nodes.find((x) => x.screen === n.id)?.type });
    }
  }
  const edges = [];
  for (const e of laid.edges ?? []) {
    const off = abs[e.container ?? 'root'] ?? abs.root;
    const meta = graph.edges.find((x) => x.id === e.id);
    const points = [];
    for (const s of e.sections ?? []) {
      points.push(s.startPoint, ...(s.bendPoints ?? []), s.endPoint);
    }
    edges.push({
      ...meta,
      points: points.map((p) => ({ x: p.x + off.x, y: p.y + off.y })),
      labelAt: e.labels?.[0] ? { x: e.labels[0].x + off.x, y: e.labels[0].y + off.y, w: e.labels[0].width, h: e.labels[0].height } : null,
    });
  }
  return { ok: true, width: laid.width, height: laid.height, sections, nodes, edges, dead: graph.dead, orphans: graph.orphans };
}
