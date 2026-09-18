import type { ToolPropertySchema, ToolSchema } from '../types/tool-schema.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function checkType(expectedType: string, value: unknown): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !Number.isNaN(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

function validateProperty(
  propPath: string,
  schema: ToolPropertySchema,
  value: unknown,
  errors: string[],
): void {
  if (value === undefined) {
    return;
  }

  if (value === null) {
    if (schema.type !== 'null') {
      errors.push(`Property "${propPath}" expected type "${schema.type}", received "null".`);
    }
    return;
  }

  if (!checkType(schema.type, value)) {
    const received = Array.isArray(value) ? 'array' : typeof value;
    errors.push(`Property "${propPath}" expected type "${schema.type}", received "${received}".`);
    return;
  }

  if (schema.enum && schema.enum.length > 0) {
    const allowed = schema.enum as readonly unknown[];
    if (!allowed.includes(value)) {
      const allowedStr = schema.enum.map((v) => JSON.stringify(v)).join(', ');
      errors.push(
        `Property "${propPath}" value ${JSON.stringify(value)} is not one of allowed values: [${allowedStr}].`,
      );
    }
  }

  if (schema.type === 'array' && Array.isArray(value) && schema.items) {
    for (let i = 0; i < value.length; i++) {
      validateProperty(`${propPath}[${i}]`, schema.items, value[i], errors);
    }
  }

  if (
    schema.type === 'object' &&
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  ) {
    const obj = value as Record<string, unknown>;

    if (schema.required) {
      for (const req of schema.required) {
        if (!(req in obj) || obj[req] === undefined) {
          errors.push(`Missing required property "${propPath}.${req}".`);
        }
      }
    }

    if (schema.properties) {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          validateProperty(`${propPath}.${key}`, subSchema, obj[key], errors);
        }
      }
    }
  }
}

export function validateToolInput(schema: ToolSchema, input: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      valid: false,
      errors: ['Input must be a valid object.'],
    };
  }

  const obj = input as Record<string, unknown>;

  // Check required properties at the top level
  if (schema.required) {
    for (const req of schema.required) {
      if (!(req in obj) || obj[req] === undefined) {
        errors.push(`Missing required property "${req}".`);
      }
    }
  }

  // Check defined properties
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in obj) {
        validateProperty(key, propSchema, obj[key], errors);
      }
    }
  }

  // Check additional properties if disallowed
  if (schema.additionalProperties === false && schema.properties) {
    const allowedKeys = new Set(Object.keys(schema.properties));
    for (const key of Object.keys(obj)) {
      if (!allowedKeys.has(key)) {
        errors.push(`Unexpected property "${key}".`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
