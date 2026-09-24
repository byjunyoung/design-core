import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../schema/${name}`, import.meta.url), 'utf8'));

const ajv = new Ajv2020({ allErrors: true, strict: false });
const screenValidator = ajv.compile(load('screen.schema.json'));
const conventionsValidator = ajv.compile(load('conventions.schema.json'));

function run(validator, doc) {
  const ok = validator(doc);
  const errors = ok
    ? []
    : validator.errors.map((e) => {
        const extra = e.params?.additionalProperty;
        // A key with a space in it almost always means prose with an unquoted comma
        // inside a flow-style mapping: `{ when: Cancel, X or backdrop }`.
        const hint = extra && /\s/.test(extra) ? ' — an unquoted comma in a flow-style value? quote the whole value' : '';
        return {
          path: e.instancePath || '/',
          message: `${e.instancePath || '/'} ${e.message}${extra ? ` (${extra})` : ''}${hint}`,
        };
      });
  return { ok, errors };
}

export const validateScreen = (doc) => run(screenValidator, doc);
export const validateConventions = (doc) => run(conventionsValidator, doc);

const componentValidator = ajv.compile(load('component.schema.json'));
export const validateComponent = (doc) => run(componentValidator, doc);
