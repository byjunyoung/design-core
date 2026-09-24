import { resolveFlowTarget } from './flows.js';

// The domain canvas: the page a Figma file had per domain, rebuilt from the files. A section
// is "NN. {domain} - {feature}" (the shape fig's conventions name), so a domain is what comes
// before " - " and every section that shares it sits on one canvas, in sections.yaml order.
// Inside a section the happy path comes first: the entry screen — the one no flow in the
// section arrives at — then the screens its flows reach, left to right; the other states of a
// screen stack under its Default. Nothing here decides pixels; the page lays the frames out
// with CSS at their real size and draws the arrows from what it measures.

export function domainOf(section) {
  const m = /^(?:\d+\.\s*)?(.+?)(?:\s+-\s+(.+))?$/u.exec(String(section ?? '').trim());
  if (!m) return { domain: String(section ?? ''), feature: null };
  return { domain: m[1].trim(), feature: m[2] ? m[2].trim() : null };
}

export const slugOf = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'domain';

function statesOf(project, s) {
  const known = project.conventions.states?.known ?? [];
  const present = Object.keys(s.doc.states ?? {});
  return ['Default', ...known.filter((x) => x !== 'Default' && present.includes(x)), ...present.filter((x) => !known.includes(x))];
}

// Flow first: the entry screen, then what its flows reach, breadth first; anything untouched
// keeps file order. A flow that goes back or dismisses is not a step of the happy path, so it
// does not make its target look like an entry — every screen of a loop has something arriving.
// The entry is the screen with the fewest arrivals and the most departures, file order as the
// tie-break, which is what a person picks by eye: the first screen the flow leaves from.
const BACKWARDS = new Set(['back', 'dismiss']);
// When flows say nothing about direction, the screen type does: a list or a page is where a
// person arrives, a form or a modal is a step they take from there.
const TYPE_RANK = { list: 0, page: 0, search: 0, dashboard: 0, home: 0, detail: 1, form: 1, settings: 1, modal: 2, sheet: 2, confirm: 2, dialog: 2 };
export function happyPathOrder(project, screens) {
  const names = screens.map((s) => s.doc.screen);
  const inSection = new Set(names);
  const out = new Map(names.map((n) => [n, []]));
  const arrivals = new Map(names.map((n) => [n, new Set()]));
  for (const s of screens)
    for (const flow of s.doc.flows ?? []) {
      const target = resolveFlowTarget(flow.to, project.screens);
      if (!target || !inSection.has(target.screen) || target.screen === s.doc.screen) continue;
      if (BACKWARDS.has(flow.nav) || BACKWARDS.has(flow.gesture)) continue;
      if (!out.get(s.doc.screen).includes(target.screen)) out.get(s.doc.screen).push(target.screen);
      arrivals.get(target.screen).add(s.doc.screen);
    }
  const rank = (n) => TYPE_RANK[screens.find((s) => s.doc.screen === n)?.doc.type] ?? 1;
  const score = (n) => arrivals.get(n).size - out.get(n).length;
  const order = [];
  const seen = new Set();
  const visit = (n) => {
    const queue = [n];
    while (queue.length) {
      const cur = queue.shift();
      if (seen.has(cur)) continue;
      seen.add(cur);
      order.push(cur);
      for (const next of out.get(cur) ?? []) if (!seen.has(next)) queue.push(next);
    }
  };
  while (seen.size < names.length) {
    const rest = names.filter((n) => !seen.has(n));
    visit(rest.slice().sort((a, b) => score(a) - score(b) || rank(a) - rank(b) || names.indexOf(a) - names.indexOf(b))[0]);
  }
  return order.map((n) => screens.find((s) => s.doc.screen === n));
}

export function canvasPages(project) {
  const bySection = {};
  for (const s of project.screens) (bySection[s.doc.section] ??= []).push(s);
  const order = [...project.sections.filter((x) => bySection[x]), ...Object.keys(bySection).filter((x) => !project.sections.includes(x))];
  const pages = [];
  for (const section of order) {
    const { domain, feature } = domainOf(section);
    let page = pages.find((p) => p.domain === domain);
    if (!page) {
      page = { domain, slug: slugOf(domain), sections: [] };
      pages.push(page);
    }
    page.sections.push({
      name: section,
      feature,
      screens: happyPathOrder(project, bySection[section]).map((s) => ({ screen: s.doc.screen, type: s.doc.type, states: statesOf(project, s) })),
    });
  }
  // two domains may slug alike ("Shop" and "shop"); keep the links distinct
  const used = new Set();
  for (const p of pages) {
    let slug = p.slug;
    for (let i = 2; used.has(slug); i++) slug = `${p.slug}-${i}`;
    used.add(slug);
    p.slug = slug;
  }
  return pages;
}
