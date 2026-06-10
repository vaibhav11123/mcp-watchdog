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

export function formatServerSummary(config: McpServerConfig): string {
  if (config.type === 'http') {
    return config.url;
  }
  const args = config.args?.join(' ') ?? '';
  return `${config.command}${args ? ` ${args}` : ''}`;
}

/** Stable fingerprint from server names + command/args/url — excludes env and header values. */
function fingerprintEntry(name: string, config: McpServerConfig): string {
  if (config.type === 'stdio') {
    const args = (config.args ?? []).join('\0');
    return `${name}\0stdio\0${config.command}\0${args}`;
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
