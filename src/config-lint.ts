import { extractServersBlock } from './config-core';

export type LintSeverity = 'error' | 'warning';

/** Structure-only diagnostic; line/character are 0-based. */
export interface LintDiagnostic {
  severity: LintSeverity;
  message: string;
  line: number;
  character: number;
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0;
}

function entryMissingCommandAndUrl(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return true;
  const e = entry as Record<string, unknown>;
  return !hasNonEmptyString(e.command) && !hasNonEmptyString(e.url);
}

/**
 * Pure parse/structure lint for mcp.json text. Does not expand vars or import vscode.
 */
export function lintMcpJsonRaw(raw: string): LintDiagnostic[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [
      {
        severity: 'error',
        message: 'Invalid JSON',
        line: 0,
        character: 0,
      },
    ];
  }

  const block = extractServersBlock(parsed);
  if (!block) {
    return [
      {
        severity: 'warning',
        message: 'Missing "servers" or "mcpServers" root key',
        line: 0,
        character: 0,
      },
    ];
  }

  const names = Object.keys(block);
  if (names.length === 0) {
    return [
      {
        severity: 'warning',
        message: 'Empty servers object',
        line: 0,
        character: 0,
      },
    ];
  }

  const diagnostics: LintDiagnostic[] = [];
  for (const name of names) {
    if (entryMissingCommandAndUrl(block[name])) {
      diagnostics.push({
        severity: 'error',
        message: `Server "${name}" is missing both "command" and "url"`,
        line: 0,
        character: 0,
      });
    }
  }
  return diagnostics;
}
