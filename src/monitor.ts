import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpServerConfig } from './config';

export type ServerState = 'connecting' | 'healthy' | 'degraded' | 'failed' | 'disconnected';

export interface ServerStatus {
  name: string;
  state: ServerState;
  lastPingMs?: number;
  lastError?: string;
  retryCount: number;
  lastConnectedAt?: Date;
  lastFailedAt?: Date;
}

export class ServerMonitor {
  private client: Client | null = null;
  private pingTimer: ReturnType<typeof setTimeout> | null = null;
  private status: ServerStatus;
  private retryCount = 0;
  private closing = false;

  constructor(
    private readonly name: string,
    private readonly config: McpServerConfig,
    private readonly options: {
      pingIntervalMs: number;
      maxRetries: number;
      initialBackoffMs: number;
      backoffMultiplier: number;
      maxBackoffMs: number;
    },
    private readonly onStatusChange: (status: ServerStatus) => void,
    private readonly log: (msg: string) => void
  ) {
    this.status = { name, state: 'disconnected', retryCount: 0 };
  }

  async start(): Promise<void> {
    this.closing = false;
    await this.connect();
  }

  async stop(): Promise<void> {
    this.closing = true;
    this.clearPingTimer();
    await this.client?.close().catch(() => {});
    this.client = null;
    this.setStatus('disconnected');
  }

  async forceReconnect(): Promise<void> {
    this.retryCount = 0;
    await this.stop();
    this.closing = false;
    await this.connect();
  }

  getStatus(): ServerStatus {
    return { ...this.status };
  }

  /** After sleep/wake: ping soon if connected, otherwise try a fresh connect cycle. */
  wakeUp(): void {
    if (this.closing) return;
    this.clearPingTimer();
    this.pingTimer = setTimeout(() => {
      if (this.client) {
        void this.doPing();
      } else {
        this.retryCount = 0;
        void this.connect();
      }
    }, 500);
  }

  private async connect(): Promise<void> {
    this.log(`[${this.name}] Connecting...`);
    this.setStatus('connecting');

    try {
      const client = new Client({ name: 'mcp-watchdog', version: '1.0.0' }, { capabilities: {} });

      const transport = this.buildTransport();
      await client.connect(transport);

      this.client = client;
      this.retryCount = 0;
      this.log(`[${this.name}] Connected`);
      this.setStatus('healthy', { lastConnectedAt: new Date() });
      this.schedulePing();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log(`[${this.name}] Connection failed: ${msg}`);
      this.setStatus('failed', { lastError: msg, lastFailedAt: new Date() });
      this.scheduleRetry();
    }
  }

  private buildTransport(): StdioClientTransport | StreamableHTTPClientTransport {
    if (this.config.type === 'stdio') {
      return new StdioClientTransport({
        command: this.config.command,
        args: this.config.args ?? [],
        env: this.config.env,
        cwd: this.config.cwd,
      });
    }

    const requestInit: RequestInit | undefined =
      this.config.headers && Object.keys(this.config.headers).length > 0
        ? { headers: this.config.headers }
        : undefined;

    return new StreamableHTTPClientTransport(new URL(this.config.url), {
      ...(requestInit ? { requestInit } : {}),
      reconnectionOptions: {
        initialReconnectionDelay: this.options.initialBackoffMs,
        maxReconnectionDelay: this.options.maxBackoffMs,
        reconnectionDelayGrowFactor: this.options.backoffMultiplier,
        maxRetries: this.options.maxRetries,
      },
    });
  }

  private schedulePing(): void {
    this.clearPingTimer();
    if (this.closing) return;

    this.pingTimer = setTimeout(() => {
      void this.doPing();
    }, this.options.pingIntervalMs);
  }

  private async doPing(): Promise<void> {
    if (!this.client || this.closing) return;

    const start = Date.now();
    try {
      await this.client.ping({ timeout: 5000 });
      const elapsed = Date.now() - start;
      this.log(`[${this.name}] Ping OK (${elapsed}ms)`);
      this.setStatus('healthy', { lastPingMs: elapsed });
      this.schedulePing();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log(`[${this.name}] Ping failed: ${msg}`);
      this.setStatus('degraded', { lastError: msg });

      await this.client.close().catch(() => {});
      this.client = null;
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    if (this.closing) return;
    if (this.retryCount >= this.options.maxRetries) {
      this.log(`[${this.name}] Max retries (${this.options.maxRetries}) reached. Giving up.`);
      this.setStatus('failed', { lastError: 'Max retries exceeded' });
      return;
    }

    const delay = Math.min(
      this.options.initialBackoffMs * Math.pow(this.options.backoffMultiplier, this.retryCount),
      this.options.maxBackoffMs
    );
    this.retryCount++;
    this.log(`[${this.name}] Retry ${this.retryCount}/${this.options.maxRetries} in ${Math.round(delay)}ms`);
    this.setStatus('degraded');

    this.pingTimer = setTimeout(() => void this.connect(), delay);
  }

  private clearPingTimer(): void {
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private setStatus(state: ServerState, extra?: Partial<ServerStatus>): void {
    this.status = { ...this.status, state, retryCount: this.retryCount, ...extra };
    this.onStatusChange({ ...this.status });
  }
}
