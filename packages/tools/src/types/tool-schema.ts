export type ToolPropertyType =
  'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

export interface ToolPropertySchema {
  type: ToolPropertyType;
  description?: string;
  enum?: readonly (string | number | boolean)[];
  items?: ToolPropertySchema;
  properties?: Record<string, ToolPropertySchema>;
  required?: readonly string[];
  default?: unknown;
}

export interface ToolSchema {
  type: 'object';
  properties: Record<string, ToolPropertySchema>;
  required?: readonly string[];
  description?: string;
  additionalProperties?: boolean;
}
