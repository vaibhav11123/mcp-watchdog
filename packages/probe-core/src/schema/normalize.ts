import { createHash } from 'node:crypto';

export interface ToolDefinition {
  name: string;
  description?: string;
  title?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

/** Sort tools by name; normalize required arrays. */
export function normalizeTools(tools: ToolDefinition[]): ToolDefinition[] {
  return [...tools]
    .map((t) => ({
      name: t.name,
      description: t.description ?? '',
      title: t.title,
      inputSchema: normalizeSchemaObject(t.inputSchema),
      outputSchema: t.outputSchema ? normalizeSchemaObject(t.outputSchema) : undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeSchemaObject(
  schema: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return {};
  const out: Record<string, unknown> = { ...schema };
  if (Array.isArray(out.required)) {
    out.required = [...(out.required as string[])].map(String).sort();
  }
  return out;
}

/** Order-independent hash of normalized tools snapshot. */
export function toolsSnapshotHash(tools: ToolDefinition[]): string {
  const normalized = normalizeTools(tools);
  const json = JSON.stringify(normalized);
  return createHash('sha256').update(json).digest('hex');
}

export function typeSet(schema: unknown): Set<string> | undefined {
  if (!schema || typeof schema !== 'object' || !('type' in schema)) return undefined;
  const t = (schema as { type?: unknown }).type;
  if (typeof t === 'string') return new Set([t]);
  if (Array.isArray(t)) {
    return new Set(t.filter((x): x is string => typeof x === 'string'));
  }
  return undefined;
}

export function enumSet(schema: unknown): Set<string> | undefined {
  if (!schema || typeof schema !== 'object' || !('enum' in schema)) return undefined;
  const e = (schema as { enum?: unknown }).enum;
  if (!Array.isArray(e)) return undefined;
  return new Set(e.map((v) => JSON.stringify(v)));
}

export function requiredSet(schema: unknown): Set<string> {
  if (!schema || typeof schema !== 'object') return new Set();
  const r = (schema as { required?: unknown }).required;
  if (!Array.isArray(r)) return new Set();
  return new Set(r.filter((x): x is string => typeof x === 'string'));
}

export function propertiesOf(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return {};
  const p = (schema as { properties?: unknown }).properties;
  if (!p || typeof p !== 'object') return {};
  return p as Record<string, unknown>;
}
