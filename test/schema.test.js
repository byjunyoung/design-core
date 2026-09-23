import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { validateScreen, validateConventions } from '../src/validate.js';

const read = (p) => parse(readFileSync(new URL(p, import.meta.url), 'utf8'));

test('the example screen from DESIGN.md validates against the screen schema', () => {
  const doc = read('../examples/orders/screens/order-list.yaml');
  const result = validateScreen(doc);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test('a screen without elements fails validation with a path', () => {
  const doc = read('../examples/orders/screens/order-list.yaml');
  delete doc.elements;
  const result = validateScreen(doc);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.message.includes('elements')));
});

test('the example conventions validate against the conventions schema', () => {
  const doc = read('../conventions.example.yaml');
  const result = validateConventions(doc);
  assert.deepEqual(result.errors, []);
});
