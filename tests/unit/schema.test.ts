import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { validateOrThrow, formatErrors, compileDefinition, loadSchema } from '@/scripts/lib/schema';
import * as path from 'node:path';

const ajv = new Ajv({ strict: false, allErrors: true });

const personSchema = {
  type: 'object',
  required: ['name', 'age'],
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
  },
};

const validate = ajv.compile(personSchema);

describe('validateOrThrow', () => {
  it('passes for valid data without throwing', () => {
    expect(() => validateOrThrow(validate, { name: 'Alice', age: 30 }, 'test')).not.toThrow();
  });

  it('throws for invalid data', () => {
    expect(() => validateOrThrow(validate, { name: 42 }, 'test')).toThrow();
  });

  it('error message contains the label', () => {
    expect(() => validateOrThrow(validate, { age: 30 }, 'my-label')).toThrow(/my-label/);
  });

  it('error message contains path info for missing required field', () => {
    expect(() => validateOrThrow(validate, { name: 'x' }, 'test')).toThrow(/schema validation failed/);
  });

  it('error message contains ajv path breadcrumbs for type mismatch', () => {
    expect(() =>
      validateOrThrow(validate, { name: 123, age: 'not-a-number' }, 'test-label')
    ).toThrow();
  });
});

describe('formatErrors', () => {
  it('returns no-errors string for null', () => {
    expect(formatErrors(null)).toBe('(no errors)');
  });

  it('returns no-errors string for empty array', () => {
    expect(formatErrors([])).toBe('(no errors)');
  });

  it('formats a single error with path and message', () => {
    const errs = [{ instancePath: '/name', message: 'must be string', keyword: 'type', params: {}, schemaPath: '' }];
    const out = formatErrors(errs);
    expect(out).toContain('/name');
    expect(out).toContain('must be string');
  });
});

describe('loadSchema + compileDefinition', () => {
  it('loads a real schema file and compiles', () => {
    const schemaPath = path.resolve(
      process.cwd(),
      'fixtures/diagnostic_fixtures/diagnostic-fixture.schema.json'
    );
    const compiled = loadSchema(schemaPath);
    expect(compiled.validate).toBeDefined();
    expect(typeof compiled.definitions).toBe('object');
  });

  it('compileDefinition returns a validate function for a known definition', () => {
    const schemaPath = path.resolve(
      process.cwd(),
      'fixtures/diagnostic_fixtures/diagnostic-fixture.schema.json'
    );
    const compiled = loadSchema(schemaPath);
    const validateF1 = compileDefinition(compiled, 'F1');
    expect(typeof validateF1).toBe('function');
  });

  it('compileDefinition throws for unknown definition name', () => {
    const schemaPath = path.resolve(
      process.cwd(),
      'fixtures/diagnostic_fixtures/diagnostic-fixture.schema.json'
    );
    const compiled = loadSchema(schemaPath);
    expect(() => compileDefinition(compiled, 'NonExistentDef')).toThrow(/not found/);
  });
});
