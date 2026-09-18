import { describe, it, expect } from 'vitest';
import { validateToolInput, type ToolSchema } from '@sora/tools';

describe('validateToolInput', () => {
  const sampleSchema: ToolSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path',
      },
      lineCount: {
        type: 'number',
        description: 'Number of lines',
      },
      verbose: {
        type: 'boolean',
        description: 'Verbose mode',
      },
      mode: {
        type: 'string',
        enum: ['read', 'write', 'append'],
      },
      options: {
        type: 'object',
        properties: {
          encoding: { type: 'string' },
        },
        required: ['encoding'],
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['path'],
    additionalProperties: false,
  };

  it('should pass with valid required and optional arguments', () => {
    const result = validateToolInput(sampleSchema, {
      path: 'src/index.ts',
      lineCount: 42,
      verbose: true,
      mode: 'read',
      options: { encoding: 'utf-8' },
      tags: ['typescript', 'core'],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should pass when only required arguments are provided', () => {
    const result = validateToolInput(sampleSchema, {
      path: 'package.json',
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when a required property is missing', () => {
    const result = validateToolInput(sampleSchema, {
      verbose: false,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required property "path".');
  });

  it('should fail when an argument has the wrong type', () => {
    const result = validateToolInput(sampleSchema, {
      path: 12345, // should be string
      lineCount: 'forty-two', // should be number
      verbose: 'yes', // should be boolean
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Property "path" expected type "string", received "number".');
    expect(result.errors).toContain(
      'Property "lineCount" expected type "number", received "string".',
    );
    expect(result.errors).toContain(
      'Property "verbose" expected type "boolean", received "string".',
    );
  });

  it('should fail on malformed input (non-objects)', () => {
    expect(validateToolInput(sampleSchema, null).valid).toBe(false);
    expect(validateToolInput(sampleSchema, 'string input').valid).toBe(false);
    expect(validateToolInput(sampleSchema, 123).valid).toBe(false);
    expect(validateToolInput(sampleSchema, [1, 2, 3]).valid).toBe(false);
    expect(validateToolInput(sampleSchema, undefined).valid).toBe(false);
  });

  it('should validate enum constraints', () => {
    const invalidEnum = validateToolInput(sampleSchema, {
      path: 'file.txt',
      mode: 'execute', // not in ['read', 'write', 'append']
    });

    expect(invalidEnum.valid).toBe(false);
    expect(invalidEnum.errors[0]).toContain('not one of allowed values');
  });

  it('should validate nested object properties and required fields', () => {
    const missingNested = validateToolInput(sampleSchema, {
      path: 'file.txt',
      options: {}, // missing required 'encoding'
    });

    expect(missingNested.valid).toBe(false);
    expect(missingNested.errors).toContain('Missing required property "options.encoding".');

    const wrongNestedType = validateToolInput(sampleSchema, {
      path: 'file.txt',
      options: { encoding: 123 },
    });

    expect(wrongNestedType.valid).toBe(false);
    expect(wrongNestedType.errors).toContain(
      'Property "options.encoding" expected type "string", received "number".',
    );
  });

  it('should validate array items', () => {
    const invalidArrayItem = validateToolInput(sampleSchema, {
      path: 'file.txt',
      tags: ['good', 123, 'another'],
    });

    expect(invalidArrayItem.valid).toBe(false);
    expect(invalidArrayItem.errors).toContain(
      'Property "tags[1]" expected type "string", received "number".',
    );
  });

  it('should reject unexpected properties when additionalProperties is false', () => {
    const extraProps = validateToolInput(sampleSchema, {
      path: 'file.txt',
      unknownProp: 'surprise',
    });

    expect(extraProps.valid).toBe(false);
    expect(extraProps.errors).toContain('Unexpected property "unknownProp".');
  });
});
