import { RESERVED_KEYS, elementProps } from './components.js';

// A compound component — a contract with `elements:` — is drawn as the tree it declares. The
// screen holds only the instance: its kind, the props the contract declares, and elements
// for the slots it names. Expansion happens after mergeState and before render, so a state
// patch that sets a prop (`set: { soldout: true }`) is what the tree sees. Nothing inside an
// instance can be patched from the screen: the children's ids are `<instance>/<child>`, a
// shape the screen schema does not allow, so a patch can never name one.

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const isElement = (v) => isObj(v) && typeof v.id === 'string' && typeof v.kind === 'string';
const MAX_DEPTH = 8;

// `$name` alone is the prop's value, of whatever type; `${name}` inside a string is its text.
function substitute(value, props) {
  if (typeof value === 'string') {
    const whole = /^\$([a-z][a-z0-9_-]*)$/.exec(value);
    if (whole) return props[whole[1]];
    return value.replace(/\$\{([a-z][a-z0-9_-]*)\}/g, (_, name) => (props[name] === undefined || props[name] === null ? '' : String(props[name])));
  }
  if (Array.isArray(value)) return value.map((x) => substitute(x, props));
  if (isObj(value) && !('$tbd' in value)) return Object.fromEntries(Object.entries(value).map(([k, x]) => [k, substitute(x, props)]));
  return value;
}

// A condition inside a compound that names one of its props is settled at expansion:
// `soldout` / `!soldout`. Anything else stays on the element as the condition it is.
function settle(expr, props) {
  const m = /^(!?)\s*([a-z][a-z0-9_-]*)$/.exec(String(expr ?? ''));
  if (!m || !(m[2] in props)) return null;
  const truthy = !!props[m[2]];
  return m[1] === '!' ? !truthy : truthy;
}

function defaultsOf(contract) {
  const out = {};
  for (const [name, def] of Object.entries(contract.props ?? {})) if (def && 'default' in def) out[name] = def.default;
  return out;
}

function expandOne(instance, contract, registry, layout, depth) {
  const props = { ...defaultsOf(contract), ...elementProps(instance) };
  const slots = isObj(instance.slots) ? instance.slots : {};
  const prefix = `${instance.id}/`;
  const children = [];
  const from = `components/${contract.file ? contract.file.split('/').pop() : `${contract.kind}.yaml`}`;

  const place = (node, path) => {
    if (!isObj(node)) return;
    if (typeof node.slot === 'string' && !isElement(node)) {
      for (const filled of [].concat(slots[node.slot] ?? [])) if (isElement(filled)) children.push(filled);
      return;
    }
    if (!isElement(node)) return;
    const el = substitute({ ...node }, props);
    for (const key of ['show_when', 'disabled_when']) {
      if (el[key] === undefined) continue;
      const verdict = settle(el[key], props);
      if (verdict === null) continue;
      if (key === 'show_when' && !verdict) return;
      if (key === 'disabled_when') {
        if (verdict) el.disabled = true;
        delete el.disabled_when;
      } else delete el.show_when;
    }
    el.id = prefix + node.id;
    el.$from = { file: from, path };
    if (Array.isArray(node.children)) {
      el.children = [];
      node.children.forEach((c, i) => {
        const before = children.length;
        place(c, `${path}.children.${i}`);
        el.children.push(...children.splice(before));
      });
    }
    children.push(el);
  };
  (contract.elements ?? []).forEach((node, i) => place(node, `elements.${i}`));

  // the contract's layout is keyed by its own ids; the screen's rule for the instance wins on
  // the outside (size, grow, where it sits), the contract's root rule on the inside
  for (const [key, rule] of Object.entries(contract.layout ?? {})) {
    if (key === 'root') layout[instance.id] = { ...rule, ...(layout[instance.id] ?? {}) };
    else layout[prefix + key] = { ...rule, ...(layout[prefix + key] ?? {}) };
  }
  const wrapper = { ...instance, children: expandAll(children, registry, layout, depth + 1), $expanded: true };
  delete wrapper.slots;
  return wrapper;
}

function expandAll(elements, registry, layout, depth) {
  if (depth > MAX_DEPTH) return elements;
  return elements.map((el) => {
    if (!isElement(el)) return el;
    const contract = registry[el.kind];
    if (Array.isArray(contract?.elements) && contract.elements.length) return expandOne(el, contract, registry, layout, depth);
    if (Array.isArray(el.children)) return { ...el, children: expandAll(el.children, registry, layout, depth) };
    return el;
  });
}

// `view` is what mergeState returned. Returns a new elements tree and a layout that also
// carries the contracts' rules; the inputs are not touched.
export function expandComponents(view, registry = {}) {
  const layout = structuredClone(view.layout ?? {});
  const elements = expandAll(structuredClone(view.elements ?? []), registry, layout, 0);
  return { ...view, elements, layout };
}

export const isReservedKey = (k) => RESERVED_KEYS.has(k) || k.startsWith('$');
