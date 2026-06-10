export type McpServerConfig =
  | {
      type: 'stdio';
      command: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
    }
  | {
      type: 'http';
      url: string;
      headers?: Record<string, string>;
    };

export interface McpConfig {
  servers: Record<string, McpServerConfig>;
}

export type McpConfigStatus =
  | { kind: 'no_workspace' }
  | { kind: 'no_config' }
  | { kind: 'empty_servers'; sources: string[] }
  | { kind: 'untrusted'; sources: string[]; serverCount: number }
  | { kind: 'ok'; sources: string[] };

export interface McpConfigResult {
  status: McpConfigStatus;
  config: McpConfig | null;
}

export type ParseConfigResult =
  | { ok: true; servers: Record<string, McpServerConfig> }
  | { ok: false; error: 'syntax' | 'no_block' };

export interface ConfigLayer {
  servers: Record<string, McpServerConfig>;
  label: string;
}

const WORKSPACE_FOLDER = /\$\{workspaceFolder\}/g;

/** Same placeholder VS Code substitutes for MCP; watchdog reads JSON from disk, so expand explicitly. */
export function expandWorkspaceVars<V>(value: V, workspaceRoot: string | undefined): V {
  if (!workspaceRoot) return value;
  if (typeof value === 'string') return value.replace(WORKSPACE_FOLDER, workspaceRoot) as V;
  if (Array.isArray(value))
    return value.map((item) => expandWorkspaceVars(item, workspaceRoot)) as V;
  if (value !== null && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(o)) out[key] = expandWorkspaceVars(o[key], workspaceRoot);
    return out as V;
  }
  return value;
}

export function extractServersBlock(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  const block = o.servers ?? o.mcpServers;
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
  return block as Record<string, unknown>;
}

export function normalizeServerEntry(entry: unknown): McpServerConfig | null {
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as Record<string, unknown>;

  const explicitType = e.type;
  if (explicitType === 'http' || (typeof e.url === 'string' && e.url.length > 0)) {
    const url = typeof e.url === 'string' ? e.url : '';
    if (!url) return null;
    const headers =
      e.headers && typeof e.headers === 'object' && !Array.isArray(e.headers)
        ? (e.headers as Record<string, string>)
        : undefined;
    return { type: 'http', url, headers };
  }

  const command = typeof e.command === 'string' ? e.command : '';
  if (!command) return null;

  return {
    type: 'stdio',
    command,
    args: Array.isArray(e.args) ? (e.args as string[]) : undefined,
    env:
      e.env && typeof e.env === 'object' && !Array.isArray(e.env)
        ? (e.env as Record<string, string>)
        : undefined,
    cwd: typeof e.cwd === 'string' ? e.cwd : undefined,
  };
}

export function parseConfigFile(raw: string, workspaceRoot?: string): ParseConfigResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'syntax' };
  }

  const block = extractServersBlock(parsed);
  if (!block) return { ok: false, error: 'no_block' };

  const servers: Record<string, McpServerConfig> = {};
  for (const key of Object.keys(block)) {
    const normalized = normalizeServerEntry(block[key]);
    if (normalized) {
      servers[key] = expandWorkspaceVars(normalized, workspaceRoot);
    }
  }
  return { ok: true, servers };
}

export function mergeConfigLayers(layers: (ConfigLayer | null)[]): {
  merged: Record<string, McpServerConfig>;
  sources: string[];
} {
  const merged: Record<string, McpServerConfig> = {};
  const sources: string[] = [];
  for (const layer of layers) {
    if (!layer) continue;
    sources.push(layer.label);
    Object.assign(merged, layer.servers);
  }
  return { merged, sources: [...new Set(sources)] };
}

export function emptyViewMessage(status: McpConfigStatus): string {
  switch (status.kind) {
    case 'no_workspace':
      return 'Open a folder to monitor MCP servers.';
    case 'no_config':
      return 'Add MCP config: .vscode/mcp.json (VS Code) or .cursor/mcp.json (Cursor). Global: ~/.cursor/mcp.json';
    case 'empty_servers':
      return 'mcp.json found but no valid servers. Use a "servers" or "mcpServers" object with stdio (command) or http (url) entries.';
    case 'untrusted':
      return 'Approval required before MCP Watchdog connects to your MCP servers. Run "Review Trusted Servers" or click the status bar.';
    default:
      return '';
  }
}
