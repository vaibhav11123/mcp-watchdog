import { createHash } from 'node:crypto';
import type { McpServerConfig } from './config-core';

export interface MementoLike {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void>;
}

export interface TrustApproval {
  fingerprint: string;
  allowedServers: string[];
}

/** Strip query/fragment so tokens in URLs never appear in trust UI. */
export function displayUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return raw.split('?')[0]?.split('#')[0] ?? raw;
  }
}

export function formatServerSummary(config: McpServerConfig): string {
  if (config.type === 'http' || config.type === 'sse') {
    return displayUrl(config.url);
  }
  const args = config.args?.join(' ') ?? '';
  return `${config.command}${args ? ` ${args}` : ''}`;
}

/** Stable fingerprint — excludes env/header values; includes cwd + env key names. */
function fingerprintEntry(name: string, config: McpServerConfig): string {
  if (config.type === 'stdio') {
    const args = (config.args ?? []).join('\0');
    const cwd = config.cwd ?? '';
    const envKeys = Object.keys(config.env ?? {})
      .sort()
      .join(',');
    return `${name}\0stdio\0${config.command}\0${args}\0${cwd}\0${envKeys}`;
  }
  if (config.type === 'sse') {
    return `${name}\0sse\0${config.url}`;
  }
  return `${name}\0http\0${config.url}`;
}

export function computeServerSetFingerprint(servers: Record<string, McpServerConfig>): string {
  const lines = Object.keys(servers)
    .sort()
    .map((name) => fingerprintEntry(name, servers[name]));
  return createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex');
}

export class TrustStore {
  constructor(
    private readonly memento: MementoLike,
    private readonly workspacePath: string,
  ) {}

  private storageKey(): string {
    return `mcpWatchdog.trust.${this.workspacePath}`;
  }

  get(): TrustApproval | undefined {
    return this.memento.get<TrustApproval>(this.storageKey());
  }

  approve(fingerprint: string, allowedServers: string[]): Thenable<void> {
    return this.memento.update(this.storageKey(), {
      fingerprint,
      allowedServers: [...allowedServers].sort(),
    });
  }

  revoke(): Thenable<void> {
    return this.memento.update(this.storageKey(), undefined);
  }

  isServerAllowed(fingerprint: string, serverName: string): boolean {
    const approval = this.get();
    if (!approval || approval.fingerprint !== fingerprint) {
      return false;
    }
    return approval.allowedServers.includes(serverName);
  }
}
