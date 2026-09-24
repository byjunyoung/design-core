import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTokens, resolveTokens } from '../src/tokens.js';
import { tokensToCss } from '../src/render/tokens.js';
import { loadProject } from '../src/index.js';

async function dirWith(files) {
  const dir = await mkdtemp(join(tmpdir(), 'doan-tokens-'));
  for (const [name, body] of Object.entries(files)) {
    await mkdir(join(dir, name, '..'), { recursive: true });
    await writeFile(join(dir, name), typeof body === 'string' ? body : JSON.stringify(body, null, 2));
  }
  return dir;
}

test('a flat tokens.json is read exactly as before: group → name → css string', async () => {
  const dir = await dirWith({ 'tokens.json': { space: { md: '16px' }, color: { primary: '#123456' } } });
  const got = await loadTokens(dir);
  assert.equal(got.source, 'flat');
  assert.equal(got.tokens.space.md, '16px');
  assert.equal(got.tokens.color.primary, '#123456');
  assert.deepEqual(got.problems, []);
});

test('DTCG values become css strings: color objects, dimensions, font family lists, aliases; $type comes from the group', () => {
  const doc = {
    primitive: {
      blue: { $type: 'color', 500: { $value: { colorSpace: 'srgb', components: [0.2, 0.4, 1], hex: '#3366ff' } }, 600: { $value: { colorSpace: 'srgb', components: [0, 0.5, 1] } } },
      size: { $type: 'dimension', 4: { $value: { value: 16, unit: 'px' } } },
    },
    color: { $type: 'color', primary: { $value: '{primitive.blue.500}' }, 'primary-hover': { $value: '{primitive.blue.600}' }, glass: { $value: { colorSpace: 'srgb', components: [1, 1, 1], alpha: 0.5 } } },
    space: { $type: 'dimension', md: { $value: '{primitive.size.4}' }, lg: { $value: '24px' } },
    font: { family: { $type: 'fontFamily', $value: ['Pretendard', 'Segoe UI', 'sans-serif'] }, size: { $type: 'dimension', $value: { value: 14, unit: 'px' } }, weight: { $type: 'fontWeight', $value: 600 } },
    motion: { fast: { $type: 'duration', $value: { value: 120, unit: 'ms' } }, ease: { $type: 'cubicBezier', $value: [0.4, 0, 0.2, 1] } },
    shadow: { card: { $type: 'shadow', $value: { color: '{primitive.blue.500}', offsetX: { value: 0, unit: 'px' }, offsetY: { value: 2, unit: 'px' }, blur: { value: 8, unit: 'px' }, spread: { value: 0, unit: 'px' } } } },
  };
  const { tokens, problems } = resolveTokens([doc]);
  assert.deepEqual(problems, []);
  assert.equal(tokens.color.primary, '#3366ff');
  assert.equal(tokens.color['primary-hover'], '#0080ff'); // no hex given: computed from srgb components
  assert.equal(tokens.color.glass, '#ffffff80'); // alpha becomes the fourth byte
  assert.equal(tokens.space.md, '16px');
  assert.equal(tokens.space.lg, '24px');
  assert.equal(tokens.font.family, 'Pretendard, "Segoe UI", sans-serif');
  assert.equal(tokens.font.size, '14px');
  assert.equal(tokens.font.weight, '600');
  assert.equal(tokens.motion.fast, '120ms');
  assert.equal(tokens.motion.ease, 'cubic-bezier(0.4, 0, 0.2, 1)');
  assert.equal(tokens.shadow.card, '0px 2px 8px 0px #3366ff');
  assert.equal(tokens.primitive.blue['500'], '#3366ff'); // primitives resolve too; whether a screen may name them is lint's business
});

test('nested groups reach CSS as one custom property per leaf, and a flat-shaped file inside tokens/ still counts', async () => {
  const dir = await dirWith({
    'tokens/primitive.tokens.json': { gray: { $type: 'color', 100: { $value: '#f7f7f8' } } },
    'tokens/semantic.tokens.json': { color: { $type: 'color', bg: { base: { $value: '#ffffff' }, muted: { $value: '{gray.100}' } } }, space: { xs: '4px' } },
  });
  const got = await loadTokens(dir);
  assert.equal(got.source, 'dtcg');
  assert.equal(got.tokens.color.bg.muted, '#f7f7f8');
  assert.equal(got.tokens.space.xs, '4px');
  const css = tokensToCss(got.tokens);
  assert.match(css, /--color-bg-base: #ffffff;/);
  assert.match(css, /--color-bg-muted: #f7f7f8;/);
  assert.match(css, /--gray-100: #f7f7f8;/);
});

test('a missing alias and an alias cycle are problems with a path, never a crash', () => {
  const doc = { color: { $type: 'color', a: { $value: '{color.b}' }, b: { $value: '{color.a}' }, c: { $value: '{color.nowhere}' } } };
  const { tokens, problems } = resolveTokens([doc]);
  assert.equal(tokens.color?.c, undefined);
  assert.ok(problems.some((p) => p.path === 'color.c' && /nowhere/.test(p.message)));
  assert.ok(problems.some((p) => p.path === 'color.a' && /cycle/i.test(p.message)));
});

test('later documents win token by token, and $extends copies a group before its own tokens', () => {
  const base = { space: { $type: 'dimension', sm: { $value: '8px' }, md: { $value: '16px' } } };
  const over = { space: { md: { $value: '20px' } }, button: { $extends: '{space}', md: { $value: '18px' } } };
  const { tokens } = resolveTokens([base, over]);
  assert.equal(tokens.space.sm, '8px');
  assert.equal(tokens.space.md, '20px');
  assert.equal(tokens.button.sm, '8px');
  assert.equal(tokens.button.md, '18px');
});

test('a resolver gives one token set per context, the default context as tokens, and files by $ref relative to the resolver', async () => {
  const dir = await dirWith({
    'tokens/primitive.tokens.json': { gray: { $type: 'color', 0: { $value: '#ffffff' }, 900: { $value: '#111111' } } },
    'tokens/light.tokens.json': { color: { $type: 'color', bg: { $value: '{gray.0}' }, text: { $value: '{gray.900}' } } },
    'tokens/dark.tokens.json': { color: { $type: 'color', bg: { $value: '{gray.900}' }, text: { $value: '{gray.0}' } } },
    'tokens/theme.resolver.json': {
      name: 'theme',
      version: '2025.10',
      sets: { base: { sources: [{ $ref: 'primitive.tokens.json' }] } },
      modifiers: { theme: { contexts: { light: [{ $ref: 'light.tokens.json' }], dark: [{ $ref: 'dark.tokens.json' }] }, default: 'light' } },
      resolutionOrder: [{ $ref: '#/sets/base' }, { $ref: '#/modifiers/theme' }],
    },
  });
  const got = await loadTokens(dir);
  assert.equal(got.source, 'dtcg');
  assert.deepEqual(got.problems, []);
  assert.equal(got.tokens.color.bg, '#ffffff');
  assert.deepEqual(got.defaults, { theme: 'light' });
  assert.equal(got.contexts.theme.light.color.bg, '#ffffff');
  assert.equal(got.contexts.theme.dark.color.bg, '#111111');
  assert.equal(got.contexts.theme.dark.color.text, '#ffffff');
});

test('a $ref the resolver cannot open is a problem naming the file, and the rest still resolves', async () => {
  const dir = await dirWith({
    'tokens/primitive.tokens.json': { gray: { $type: 'color', 0: { $value: '#ffffff' } } },
    'tokens/theme.resolver.json': {
      version: '2025.10',
      sets: { base: { sources: [{ $ref: 'primitive.tokens.json' }, { $ref: 'missing.tokens.json' }] } },
      resolutionOrder: [{ $ref: '#/sets/base' }],
    },
  });
  const got = await loadTokens(dir);
  assert.equal(got.tokens.gray['0'], '#ffffff');
  assert.ok(got.problems.some((p) => /missing\.tokens\.json/.test(p.message)));
});

test('no tokens at all is source none with null tokens, and tokens/ wins over a flat tokens.json with a note', async () => {
  const empty = await dirWith({});
  const none = await loadTokens(empty);
  assert.equal(none.source, 'none');
  assert.equal(none.tokens, null);

  const both = await dirWith({
    'tokens.json': { space: { md: '99px' } },
    'tokens/semantic.tokens.json': { space: { $type: 'dimension', md: { $value: '16px' } } },
  });
  const got = await loadTokens(both);
  assert.equal(got.tokens.space.md, '16px');
  assert.ok(got.problems.some((p) => /tokens\.json/.test(p.message) && /ignored/i.test(p.message)));
});

test('loadProject exposes the resolved default set as project.tokens, so render and the adapters see what they always saw', async () => {
  const dir = await dirWith({
    'conventions.yaml': 'meta: { language: en }\n',
    'sections.yaml': '- A\n',
    'screens/x.yaml': 'schema: doan/0.2\nid: scr_X\nscreen: x\nsection: A\ntype: page\nelements: [{ id: a, kind: caption, text: hi }]\n',
    'tokens/semantic.tokens.json': { color: { $type: 'color', primary: { $value: '#ab12cd' } } },
  });
  const project = await loadProject(dir);
  assert.equal(project.tokens.color.primary, '#ab12cd');
  assert.equal(project.tokenSet.source, 'dtcg');
});

test('origins name the file that last defined each token, and a token missing in one context is a blocking problem naming that context', async () => {
  const dir = await dirWith({
    'tokens/primitive.tokens.json': { gray: { $type: 'color', 0: { $value: '#ffffff' }, 900: { $value: '#111111' } } },
    'tokens/light.tokens.json': { color: { $type: 'color', bg: { $value: '{gray.0}' }, text: { $value: '{gray.900}' } } },
    'tokens/dark.tokens.json': { color: { $type: 'color', bg: { $value: '{gray.900}' } } },
    'tokens/theme.resolver.json': {
      version: '2025.10',
      sets: { base: { sources: [{ $ref: 'primitive.tokens.json' }] } },
      modifiers: { theme: { contexts: { light: [{ $ref: 'light.tokens.json' }], dark: [{ $ref: 'dark.tokens.json' }] }, default: 'light' } },
      resolutionOrder: [{ $ref: '#/sets/base' }, { $ref: '#/modifiers/theme' }],
    },
  });
  const got = await loadTokens(dir);
  assert.match(got.origins['gray.0'], /primitive\.tokens\.json$/);
  assert.match(got.origins['color.bg'], /light\.tokens\.json$/);
  const gap = got.problems.find((p) => p.path === 'color.text');
  assert.ok(gap, 'the gap is reported');
  assert.equal(gap.severity, 'blocking');
  assert.match(gap.message, /theme=dark/);
  assert.match(gap.file, /theme\.resolver\.json$/);
});

test('the bundled token files resolve, for light, to exactly DEFAULT_TOKENS — so a project init wrote renders like one with no tokens', async () => {
  const { DEFAULT_TOKEN_FILES } = await import('../src/tokens.js');
  const { DEFAULT_TOKENS } = await import('../src/render/tokens.js');
  const F = DEFAULT_TOKEN_FILES;
  const light = resolveTokens([F['primitive.tokens.json'], F['semantic.tokens.json'], F['light.tokens.json']]);
  assert.deepEqual(light.problems, []);
  for (const group of Object.keys(DEFAULT_TOKENS)) assert.deepEqual(light.tokens[group], DEFAULT_TOKENS[group], group);
  const dark = resolveTokens([F['primitive.tokens.json'], F['semantic.tokens.json'], F['dark.tokens.json']]);
  assert.deepEqual(dark.problems, []);
  assert.deepEqual(Object.keys(dark.tokens.color).sort(), Object.keys(DEFAULT_TOKENS.color).sort());
  assert.notEqual(dark.tokens.color.bg, light.tokens.color.bg);
});
