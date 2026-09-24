import { mergeState } from './merge.js';
import { resolveFlowTarget } from './flows.js';
import { walkElements, findElement, elementIds } from './elements.js';
import { basename, join } from 'node:path';
import { elementProps, RESERVED_KEYS } from './components.js';
import { hasToken } from './tokens.js';
import { assetRefs } from './assets.js';
import { DEFAULT_TOKENS, mergeTokens } from './render/tokens.js';

// Each rule is (ctx) => findings. A finding names the file and the YAML path so an agent
// can edit the exact line. Severity: blocking stops handoff; warning is counted.
// Rules whose convention key is null or empty are skipped, never fired wrongly.

const BARE_UNIT = /^-?\d+(\.\d+)?(px|rem|em|%|pt)?$/;
const isTbd = (x) => x && typeof x === 'object' && '$tbd' in x;

// The component registry: components/*.yaml, or — for a project loaded without one, and for
// the rows a conventions.yaml still carries — conventions.kinds read as legacy contracts.
const registryOf = (ctx) => ctx.components ?? Object.fromEntries(Object.entries(ctx.conventions.kinds ?? {}).map(([k, d]) => [k, { kind: k, ...(d ?? {}), legacy: true, file: null }]));
const describe = (c) => (c.file ? `components/${basename(c.file)}` : `conventions.kinds.${c.kind}`);
// A finding on a file that is not a screen: a token file, a component file, conventions.yaml.
const fileFinding = (id, severity, file, path, message) => ({ id, severity, screen: null, file, path, line: null, message });
// Every token binding a contract declares, with its YAML path: tokens.<slot> and variants.<prop>.<option>.<slot>.
export function* bindingsOf(c) {
  for (const [slot, token] of Object.entries(c.tokens ?? {})) yield { path: ['tokens', slot], token };
  for (const [prop, options] of Object.entries(c.variants ?? {}))
    for (const [opt, b] of Object.entries(options ?? {})) for (const [slot, token] of Object.entries(b ?? {})) yield { path: ['variants', prop, opt, slot], token };
}
// Every patch in a screen — states and variant options — with the base path of the patch.
function* patchesOf(s) {
  for (const [state, patches] of Object.entries(s.doc.states ?? {})) for (let i = 0; i < (patches ?? []).length; i++) yield { patch: patches[i], base: ['states', state, i] };
  for (const [axis, options] of Object.entries(s.doc.variants ?? {}))
    for (const [opt, patches] of Object.entries(options ?? {})) for (let i = 0; i < (patches ?? []).length; i++) yield { patch: patches[i], base: ['variants', axis, opt, i] };
}

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
      if (screen_pattern && !new RegExp(screen_pattern, 'u').test(s.doc.screen))
        out.push(finding('L01', 'blocking', s, ['screen'], `screen name "${s.doc.screen}" does not match ${screen_pattern}`));
      if (section_pattern && !new RegExp(section_pattern, 'u').test(s.doc.section))
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
    const kinds = registryOf(ctx);
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
    const kinds = registryOf(ctx);
    if (!Object.keys(kinds).length) return [];
    const out = [];
    const check = (s, kind, path) => {
      if (kind === 'placeholder') return; // what prep leaves behind; counted by L08, not a vocabulary miss
      if (!(kind in kinds)) out.push(finding('L10', 'warning', s, path, `kind "${kind}" has no components/${kind}.yaml`));
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
  L16(ctx) {
    const vocab = ctx.conventions.flows;
    if (!vocab) return [];
    const out = [];
    for (const s of ctx.screens)
      (s.doc.flows ?? []).forEach((flow, i) => {
        if (flow.gesture && vocab.gestures?.length && !vocab.gestures.includes(flow.gesture))
          out.push(finding('L16', 'warning', s, ['flows', i, 'gesture'], `gesture "${flow.gesture}" is not in flows.gestures`));
        if (flow.nav && vocab.navs?.length && !vocab.navs.includes(flow.nav))
          out.push(finding('L16', 'warning', s, ['flows', i, 'nav'], `nav "${flow.nav}" is not in flows.navs`));
      });
    return out;
  },
  L17(ctx) {
    const table = ctx.conventions.platforms;
    if (!table) return [];
    const known = Object.keys(table).filter((k) => k !== 'default');
    if (!known.length) return [];
    return ctx.screens
      .filter((s) => s.doc.platform && !known.includes(s.doc.platform))
      .map((s) => finding('L17', 'warning', s, ['platform'], `platform "${s.doc.platform}" is not in conventions.platforms (have: ${known.join(', ')})`));
  },
  // --- tokens -------------------------------------------------------------------------------
  // What a screen names in layout (gap, padding) must be a token that resolves, and never a
  // primitive: the palette and the scale are the design system's private vocabulary, screens
  // speak in the semantic layer above it. Which files are primitive is conventions.tokens.primitive
  // (file stems under tokens/); null switches L19 off. L20 relays what the token loader could
  // not resolve — a broken alias, a $ref it could not open, a token missing in one theme —
  // because render would draw a hole where that value should be.
  L18(ctx) {
    const tokens = mergeTokens(DEFAULT_TOKENS, ctx.tokens ?? {});
    const out = [];
    const check = (s, rule, base) => {
      for (const key of ['gap', 'padding']) {
        const v = rule[key];
        if (v === undefined || BARE_UNIT.test(String(v)) || isTbd(v)) continue;
        if (!hasToken(tokens, v)) out.push(finding('L18', 'warning', s, [...base, key], `${key} "${v}" names no token`));
      }
    };
    for (const s of ctx.screens) {
      for (const [key, rule] of Object.entries(s.doc.layout ?? {})) check(s, rule, ['layout', key]);
      for (const [state, patches] of Object.entries(s.doc.states ?? {}))
        patches.forEach((p, i) => p.layout && check(s, p.layout, ['states', state, i, 'layout']));
    }
    // a contract's bindings name tokens too
    for (const c of Object.values(registryOf(ctx)))
      if (c.file) for (const { path, token } of bindingsOf(c)) if (!hasToken(tokens, token)) out.push(fileFinding('L18', 'warning', c.file, path, `${path.join('.')} "${token}" names no token`));
    return out;
  },
  L19(ctx) {
    const stems = ctx.conventions.tokens?.primitive;
    const origins = ctx.tokenSet?.origins;
    if (!stems?.length || !origins) return [];
    const stem = (file) => (file ? basename(file).replace(/\.tokens\.json$/, '') : null);
    const primitive = (name) => stems.includes(stem(origins[String(name)]));
    const out = [];
    const check = (s, rule, base) => {
      for (const key of ['gap', 'padding']) {
        const v = rule[key];
        if (v !== undefined && primitive(v)) out.push(finding('L19', 'blocking', s, [...base, key], `${key} "${v}" is a primitive token; name the semantic token that uses it`));
      }
    };
    for (const s of ctx.screens) {
      for (const [key, rule] of Object.entries(s.doc.layout ?? {})) check(s, rule, ['layout', key]);
      for (const [state, patches] of Object.entries(s.doc.states ?? {}))
        patches.forEach((p, i) => p.layout && check(s, p.layout, ['states', state, i, 'layout']));
    }
    for (const c of Object.values(registryOf(ctx)))
      if (c.file) for (const { path, token } of bindingsOf(c)) if (primitive(token)) out.push(fileFinding('L19', 'blocking', c.file, path, `${path.join('.')} "${token}" is a primitive token; bind the semantic token that uses it`));
    return out;
  },
  L20(ctx) {
    return (ctx.tokenSet?.problems ?? []).map((p) => ({
      id: 'L20',
      severity: p.severity ?? 'blocking',
      screen: null,
      file: p.file ?? ctx.tokenSet.files?.[0] ?? null,
      path: String(p.path ?? '').split('.'),
      line: null,
      message: p.context ? `${p.message} (${p.context})` : p.message,
    }));
  },
  // --- components ---------------------------------------------------------------------------
  // An instance may set only what its contract declares (the owner's rule, 2026-09-24: props
  // and slots, nothing inside). L21 is a warning because a contract that forgot a prop should
  // not stop a handoff; L22 is blocking because a missing required prop or an option the kind
  // does not have draws the wrong thing. L23 is one line per project: the rows still in
  // conventions.kinds, which `doan migrate kinds` moves into files.
  L21(ctx) {
    const registry = registryOf(ctx);
    const out = [];
    const check = (s, el, path, props) => {
      const c = registry[el.kind];
      if (!c?.props) return;
      for (const key of Object.keys(props)) if (!(key in c.props)) out.push(finding('L21', 'warning', s, [...path, key], `prop "${key}" is not declared by ${describe(c)}`));
    };
    for (const s of ctx.screens) {
      for (const { el, path } of walkElements(s.doc.elements ?? [], ['elements'])) check(s, el, path, elementProps(el));
      for (const { patch, base } of patchesOf(s)) {
        if (patch.replace) check(s, { id: patch.target, ...patch.replace }, [...base, 'replace'], elementProps(patch.replace));
        if (patch.set) {
          const hit = findElement(s.doc.elements ?? [], patch.target);
          if (hit) check(s, hit.el, [...base, 'set'], Object.fromEntries(Object.entries(patch.set).filter(([k]) => !RESERVED_KEYS.has(k))));
        }
      }
    }
    return out;
  },
  L22(ctx) {
    const registry = registryOf(ctx);
    const out = [];
    const check = (s, el, path) => {
      const c = registry[el.kind];
      if (!c) return;
      for (const [name, def] of Object.entries(c.props ?? {})) {
        const value = el[name];
        if (def?.required && value === undefined) out.push(finding('L22', 'blocking', s, path, `${el.kind} "${el.id}" is missing the required prop "${name}"`));
        if (def?.type === 'enum' && value !== undefined && !isTbd(value) && !(def.options ?? []).includes(String(value)))
          out.push(finding('L22', 'blocking', s, [...path, name], `${name} "${value}" is not one of ${(def.options ?? []).join(', ')}`));
      }
      for (const slot of Object.keys(el.slots ?? {})) if (!(c.slots ?? []).includes(slot)) out.push(finding('L22', 'blocking', s, [...path, 'slots', slot], `${el.kind} declares no slot "${slot}"`));
    };
    for (const s of ctx.screens) {
      for (const { el, path } of walkElements(s.doc.elements ?? [], ['elements'])) check(s, el, path);
      for (const { patch, base } of patchesOf(s)) if (patch.replace) check(s, { id: patch.target, ...patch.replace }, [...base, 'replace']);
    }
    return out;
  },
  L23(ctx) {
    const legacy = ctx.componentSet?.legacy ?? [];
    if (!legacy.length || !ctx.dir) return [];
    return [fileFinding('L23', 'warning', join(ctx.dir, 'conventions.yaml'), ['kinds'], `${legacy.length} kind(s) still live in conventions.kinds — move them to components/<kind>.yaml (doan migrate kinds)`)];
  },
  // --- flows ----------------------------------------------------------------------------------
  // A screen no flow reaches and no flow leaves is either the entry point or forgotten; in a
  // product with flows at all, say so. One warning per screen; nothing in a project that has
  // not drawn a single flow yet, or has one screen.
  L24(ctx) {
    if (ctx.screens.length < 2) return [];
    const touched = new Set();
    let any = false;
    for (const s of ctx.screens)
      for (const flow of s.doc.flows ?? []) {
        any = true;
        const target = resolveFlowTarget(flow.to, ctx.screens);
        touched.add(s.doc.screen);
        if (target) touched.add(target.screen);
      }
    if (!any) return [];
    return ctx.screens.filter((s) => !touched.has(s.doc.screen)).map((s) => finding('L24', 'warning', s, ['flows'], `no flow reaches or leaves "${s.doc.screen}" — an entry point, or a screen the map forgot`));
  },
  // L25 — an asset a screen or a contract names must be a file under assets/ (src/assets.js)
  L25(ctx) {
    const have = new Set((ctx.assets ?? []).map((a) => a.path));
    return assetRefs(ctx)
      .filter((r) => !have.has(r.path) && (r.screen || r.file))
      .map((r) => {
        const msg = `${r.at.join('.')} "${r.path}" names no file under assets/`;
        const s = r.screen ? ctx.screens.find((x) => x.doc.screen === r.screen) : null;
        return s ? finding('L25', 'warning', s, r.at, msg) : fileFinding('L25', 'warning', r.file, r.at, msg);
      });
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
