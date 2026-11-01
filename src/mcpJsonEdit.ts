/**
 * Safe mcp.json / mcpServers JSON edit helpers (vscode-free).
 * Refuses JSONC (comments) — caller should open file + offer Disable instead.
 */

export type JsonEditResult =
  | { ok: true; raw: string; rootKey: 'servers' | 'mcpServers' }
  | { ok: false; reason: 'syntax' | 'jsonc' | 'no_block' | 'missing_server' };

function looksLikeJsonc(raw: string): boolean {
  // Strip strings roughly, then look for // or /* */ outside — heuristic enough to refuse.
  if (/^\s*\/\//m.test(raw) || /\/\*[\s\S]*?\*\//.test(raw)) return true;
  // Trailing commas before } or ]
  if (/,\s*[}\]]/.test(raw)) return true;
  return false;
}

function extractRootKey(parsed: Record<string, unknown>): 'servers' | 'mcpServers' | null {
  if (parsed.servers && typeof parsed.servers === 'object') return 'servers';
  if (parsed.mcpServers && typeof parsed.mcpServers === 'object') return 'mcpServers';
  return null;
}

export function deleteServerKey(raw: string, serverName: string): JsonEditResult {
  if (looksLikeJsonc(raw)) {
    return { ok: false, reason: 'jsonc' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'syntax' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'syntax' };
  }
  const root = parsed as Record<string, unknown>;
  const rootKey = extractRootKey(root);
  if (!rootKey) return { ok: false, reason: 'no_block' };
  const block = root[rootKey] as Record<string, unknown>;
  if (!(serverName in block)) return { ok: false, reason: 'missing_server' };
  delete block[serverName];
  return { ok: true, raw: `${JSON.stringify(root, null, 2)}\n`, rootKey };
}

/** Merge env or headers onto an existing server entry (names+values written; caller never logs values). */
export function mergeServerCredential(
  raw: string,
  serverName: string,
  slot: { kind: 'env' | 'header'; name: string },
  value: string,
): JsonEditResult {
  if (looksLikeJsonc(raw)) {
    return { ok: false, reason: 'jsonc' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'syntax' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'syntax' };
  }
  const root = parsed as Record<string, unknown>;
  const rootKey = extractRootKey(root);
  if (!rootKey) return { ok: false, reason: 'no_block' };
  const block = root[rootKey] as Record<string, unknown>;
  const entry = block[serverName];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { ok: false, reason: 'missing_server' };
  }
  const e = entry as Record<string, unknown>;
  if (slot.kind === 'env') {
    const env =
      e.env && typeof e.env === 'object' && !Array.isArray(e.env)
        ? { ...(e.env as Record<string, string>) }
        : {};
    env[slot.name] = value;
    e.env = env;
  } else {
    const headers =
      e.headers && typeof e.headers === 'object' && !Array.isArray(e.headers)
        ? { ...(e.headers as Record<string, string>) }
        : {};
    headers[slot.name] = value;
    e.headers = headers;
  }
  return { ok: true, raw: `${JSON.stringify(root, null, 2)}\n`, rootKey };
}
