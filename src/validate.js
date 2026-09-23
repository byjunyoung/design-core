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
    : validator.errors.map((e) => ({
        path: e.instancePath || '/',
        message: `${e.instancePath || '/'} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ''}`,
      }));
  return { ok, errors };
}

export const validateScreen = (doc) => run(screenValidator, doc);
export const validateConventions = (doc) => run(conventionsValidator, doc);
