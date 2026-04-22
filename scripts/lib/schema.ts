// ajv wrapper for gen-script schema validation — plan §5.4.
// Compiles a schema file once and returns the validator + any definitions map
// so scripts can validate against a named sub-schema (e.g. F1/F2/F3).

import * as fs from 'node:fs';
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';

export type CompiledSchema = {
  validate: ValidateFunction;
  ajv: Ajv;
  definitions: Record<string, unknown>;
};

export function loadSchema(schemaPath: string): CompiledSchema {
  const raw = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as {
    definitions?: Record<string, unknown>;
  };
  const ajv = new Ajv({ strict: false, allErrors: true });
  const validate = ajv.compile(raw);
  return { validate, ajv, definitions: raw.definitions ?? {} };
}

export function compileDefinition(
  compiled: CompiledSchema,
  defName: string
): ValidateFunction {
  const def = compiled.definitions[defName];
  if (!def) {
    throw new Error(`schema definition not found: ${defName}`);
  }
  return compiled.ajv.compile(def as object);
}

export function formatErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) return '(no errors)';
  return errors
    .map((e) => `  at ${e.instancePath || '/'}: ${e.message ?? 'invalid'}`)
    .join('\n');
}

export function validateOrThrow(
  validate: ValidateFunction,
  data: unknown,
  label: string
): void {
  const ok = validate(data);
  if (!ok) {
    throw new Error(`[${label}] schema validation failed:\n${formatErrors(validate.errors)}`);
  }
}
