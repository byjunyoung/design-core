import { mergeState } from './merge.js';
import { resolveFlowTarget } from './flows.js';
import { walkElements, findElement, elementIds } from './elements.js';

// Each rule is (ctx) => findings. A finding names the file and the YAML path so an agent
// can edit the exact line. Severity: blocking stops handoff; warning is counted.
// Rules whose convention key is null or empty are skipped, never fired wrongly.

const BARE_UNIT = /^-?\d+(\.\d+)?(px|rem|em|%|pt)?$/;

function finding(id, severity, s, path, message) {
  return { id, severity, screen: s.doc.screen, file: s.file, path, line: s.lineOf(path), message };
}

// Walks any value and yields the path of every `{ $tbd: ... }` it finds.
function* walkTbd(value, path = []) {
  if (value === null || typeof value !== 'object') return;
  if ('$tbd' in value) {
    yield { path, meta: value.$tbd ?? {} };
    return;
  }
  const entries = Array.isArray(value) ? value.map((v, i) => [i, v]) : Object.entries(value);
  for (const [k, v] of entries) yield* walkTbd(v, [...path, k]);
}

const rules = {
  L01(ctx) {
    const out = [];
    const { screen_pattern, section_pattern } = ctx.conventions.naming ?? {};
    for (const s of ctx.screens) {
      if (screen_pattern && !new RegExp(screen_pattern).test(s.doc.screen))
        out.push(finding('L01', 'blocking', s, ['screen'], `screen name "${s.doc.screen}" does not match ${screen_pattern}`));
      if (section_pattern && !new RegExp(section_pattern).test(s.doc.section))
        out.push(finding('L01', 'blocking', s, ['section'], `section name "${s.doc.section}" does not match ${section_pattern}`));
    }
    return out;
  },
  L02(ctx) {
    return ctx.screens
      .filter((s) => !ctx.sections.includes(s.doc.section))
      .map((s) => finding('L02', 'blocking', s, ['section'], `section "${s.doc.section}" is not in sections.yaml`));
  },
  L03(ctx) {
    const required = ctx.conventions.states?.required ?? {};
    const out = [];
    for (const s of ctx.screens) {
      for (const state of required[s.doc.type] ?? []) {
        if (state === 'Default' || s.doc.states?.[state]) continue;
        out.push(finding('L03', 'blocking', s, ['states'], `${s.doc.type} screen is missing the ${state} state`));
      }
    }
    return out;
  },
  L04(ctx) {
    const known = ctx.conventions.states?.known;
    if (!known?.length) return [];
    const out = [];
    for (const s of ctx.screens)
      for (const state of Object.keys(s.doc.states ?? {}))
        if (!known.includes(state)) out.push(finding('L04', 'warning', s, ['states', state], `state "${state}" is not in states.known`));
    return out;
  },
  L05(ctx) {
    const out = [];
    for (const s of ctx.screens)
      (s.doc.flows ?? []).forEach((flow, i) => {
        if (!resolveFlowTarget(flow.to, ctx.screens))
          out.push(finding('L05', 'blocking', s, ['flows', i, 'to'], `flow target "${flow.to}" is not a screen or screen.state`));
      });
    return out;
  },
  L06(ctx) {
    const kinds = ctx.conventions.kinds ?? {};
    const out = [];
    for (const s of ctx.screens)
      (s.doc.flows ?? []).forEach((flow, i) => {
        const el = findElement(s.doc.elements ?? [], flow.from)?.el;
        if (!el) {
          out.push(finding('L06', 'warning', s, ['flows', i, 'from'], `flow source "${flow.from}" is not an element`));
          return;
        }
        if (flow.via && !(kinds[el.kind]?.anchors ?? []).includes(flow.via))
          out.push(finding('L06', 'warning', s, ['flows', i, 'via'], `"${flow.via}" is not an anchor of kind ${el.kind}`));
      });
    return out;
  },
  L07(ctx) {
    const out = [];
    const report = (s, patches, base) => {
      const { missingTargets } = mergeState({ ...s.doc, states: { _: patches }, variants: {} }, '_');
      for (const target of missingTargets) {
        const i = patches.findIndex((p) => p.target === target);
        out.push(finding('L07', 'blocking', s, [...base, i, 'target'], `patch target "${target}" exists in neither elements nor layout`));
      }
    };
    for (const s of ctx.screens) {
      for (const [state, patches] of Object.entries(s.doc.states ?? {})) report(s, patches, ['states', state]);
      for (const [axis, options] of Object.entries(s.doc.variants ?? {}))
        for (const [option, patches] of Object.entries(options ?? {})) report(s, patches, ['variants', axis, option]);
    }
    return out;
  },
  L08(ctx) {
    const out = [];
    for (const s of ctx.screens)
      for (const { path, meta } of walkTbd(s.doc)) {
        const overdue = meta.due && ctx.today && String(meta.due) < ctx.today;
        const who = meta.owner ? ` (${meta.owner}${meta.due ? `, due ${meta.due}` : ''})` : '';
        out.push(finding('L08', overdue ? 'blocking' : 'warning', s, path, `$tbd${who}${overdue ? ' is overdue' : ''}`));
      }
    return out;
  },
  L09(ctx) {
    const required = ctx.conventions.refs?.required ?? [];
    const out = [];
    for (const s of ctx.screens)
      for (const key of required)
        if (!s.doc.refs?.[key]) out.push(finding('L09', 'warning', s, ['refs'], `required ref "${key}" is missing`));
    return out;
  },
  L10(ctx) {
    const kinds = ctx.conventions.kinds;
    if (!kinds || !Object.keys(kinds).length) return [];
    const out = [];
    const check = (s, kind, path) => {
      if (!(kind in kinds)) out.push(finding('L10', 'warning', s, path, `kind "${kind}" is not in conventions.kinds`));
    };
    for (const s of ctx.screens) {
      for (const { el, path } of walkElements(s.doc.elements ?? [], ['elements'])) check(s, el.kind, [...path, 'kind']);
      for (const [state, patches] of Object.entries(s.doc.states ?? {}))
        patches.forEach((p, i) => p.replace && check(s, p.replace.kind, ['states', state, i, 'replace', 'kind']));
    }
    return out;
  },
  L11(ctx, prior) {
    const canonical = ctx.conventions.lifecycle?.canonical_branch;
    if (!canonical || ctx.branch !== canonical) return [];
    const out = [];
    for (const s of ctx.screens) {
      const tbds = [...walkTbd(s.doc)];
      const blocking = prior.filter((f) => f.file === s.file && f.severity === 'blocking');
      if (tbds.length || blocking.length)
        out.push(finding('L11', 'blocking', s, ['screen'], `on ${canonical}: ${tbds.length} $tbd, ${blocking.length} blocking finding(s)`));
    }
    return out;
  },
  L12(ctx) {
    const out = [];
    const seen = { id: new Map(), screen: new Map() };
    for (const s of ctx.screens)
      for (const key of ['id', 'screen']) {
        const v = s.doc[key];
        if (seen[key].has(v)) out.push(finding('L12', 'blocking', s, [key], `${key} "${v}" is also used by ${seen[key].get(v)}`));
        else seen[key].set(v, s.file);
      }
    return out;
  },
  L13(ctx) {
    const vocab = ctx.conventions.layout;
    if (!vocab) return [];
    const out = [];
    const checkRule = (s, rule, base) => {
      if (rule.kind && vocab.containers?.length && !vocab.containers.includes(rule.kind))
        out.push(finding('L13', 'blocking', s, [...base, 'kind'], `layout container "${rule.kind}" is not in layout.containers`));
      if (rule.size && vocab.size_classes?.length && !vocab.size_classes.includes(rule.size))
        out.push(finding('L13', 'blocking', s, [...base, 'size'], `size "${rule.size}" is not in layout.size_classes`));
      for (const key of ['gap', 'padding']) {
        const v = rule[key];
        if (v === undefined) continue;
        if (BARE_UNIT.test(String(v))) out.push(finding('L13', 'blocking', s, [...base, key], `${key} "${v}" is a bare unit; use a token name`));
        else if (vocab.spacing_tokens && !String(v).startsWith(vocab.spacing_tokens))
          out.push(finding('L13', 'blocking', s, [...base, key], `${key} "${v}" does not start with ${vocab.spacing_tokens}`));
      }
    };
    for (const s of ctx.screens) {
      for (const [key, rule] of Object.entries(s.doc.layout ?? {})) checkRule(s, rule, ['layout', key]);
      for (const [state, patches] of Object.entries(s.doc.states ?? {}))
        patches.forEach((p, i) => p.layout && checkRule(s, p.layout, ['states', state, i, 'layout']));
    }
    return out;
  },
  L14(ctx) {
    const out = [];
    for (const s of ctx.screens) {
      const ids = elementIds(s.doc.elements ?? []);
      for (const key of Object.keys(s.doc.layout ?? {}))
        if (key !== 'root' && !ids.has(key)) out.push(finding('L14', 'warning', s, ['layout', key], `layout key "${key}" names no element`));
    }
    return out;
  },
  L15(ctx) {
    const out = [];
    for (const s of ctx.screens) {
      const stateNames = new Set(Object.keys(s.doc.states ?? {}));
      for (const [axis, options] of Object.entries(s.doc.variants ?? {})) {
        const names = Object.keys(options ?? {});
        if (names.length < 2)
          out.push(finding('L15', 'warning', s, ['variants', axis], `variant axis "${axis}" has ${names.length} option(s); one option is a state or a note, not a variant`));
        for (const name of names)
          if (stateNames.has(name)) out.push(finding('L15', 'warning', s, ['variants', axis, name], `variant option "${name}" has the same name as a state`));
      }
    }
    return out;
  },
};

export const RULES = Object.keys(rules);

export function lint(project, { branch = null, today = new Date().toISOString().slice(0, 10) } = {}) {
  const ctx = { ...project, branch, today };
  const findings = [];
  for (const id of RULES) findings.push(...rules[id](ctx, findings));
  return findings;
}

export function summarize(findings) {
  const blocking = findings.filter((f) => f.severity === 'blocking').length;
  const warning = findings.length - blocking;
  return { blocking, warning, total: findings.length };
}
