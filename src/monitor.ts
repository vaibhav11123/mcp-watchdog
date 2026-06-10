import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpServerConfig } from './config-core';
import { jittered, type MonitorOptions } from './options';

export type ServerState = 'connecting' | 'healthy' | 'degraded' | 'failed' | 'disconnected';

export interface ServerStatus {
  name: string;
  state: ServerState;
  lastPingMs?: number;
  lastError?: string;
  retryCount: number;
  lastConnectedAt?: Date;
  lastFailedAt?: Date;
  disabled?: boolean;
  probeMode?: MonitorOptions['probeMode'];
  flapping?: boolean;
}

export interface MonitorClock {
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
  now: () => number;
}

export interface MonitorClient {
  connect(transport: unknown): Promise<void>;
  ping(opts: { timeout: number }): Promise<unknown>;
  close(): Promise<void>;
}

export type MonitorClientFactory = (
  config: McpServerConfig,
  options: MonitorOptions,
) => { client: MonitorClient; transport: unknown };

const defaultClock: MonitorClock = {
  setTimeout,
  clearTimeout,
  now: () => Date.now(),
};

function defaultClientFactory(
  config: McpServerConfig,
  options: MonitorOptions,
): { client: MonitorClient; transport: StdioClientTransport | StreamableHTTPClientTransport } {
  const client = new Client({ name: 'mcp-watchdog', version: '1.0.0' }, { capabilities: {} });
  let transport: StdioClientTransport | StreamableHTTPClientTransport;
  if (config.type === 'stdio') {
    transport = new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
      env: config.env,
      cwd: config.cwd,
    });
  } else {
    const requestInit: RequestInit | undefined =
      config.headers && Object.keys(config.headers).length > 0
        ? { headers: config.headers }
        : undefined;
    transport = new StreamableHTTPClientTransport(new URL(config.url), {
      ...(requestInit ? { requestInit } : {}),
      reconnectionOptions: {
        initialReconnectionDelay: options.initialBackoffMs,
        maxReconnectionDelay: options.maxBackoffMs,
        reconnectionDelayGrowFactor: options.backoffMultiplier,
        maxRetries: options.maxRetries,
      },
    });
  }
  return { client: client as unknown as MonitorClient, transport };
}

export class ServerMonitor {
  private client: MonitorClient | null = null;
  private pingTimer: ReturnType<typeof setTimeout> | null = null;
  private status: ServerStatus;
  private retryCount = 0;
  private closing = false;
  private readonly recentLog: string[] = [];

  constructor(
    private readonly name: string,
    private readonly config: McpServerConfig,
    readonly options: MonitorOptions,
    private readonly onStatusChange: (status: ServerStatus) => void,
    private readonly log: (msg: string) => void,
    private readonly clock: MonitorClock = defaultClock,
    private readonly clientFactory: MonitorClientFactory = defaultClientFactory,
  ) {
    this.status = {
      name,
      state: 'disconnected',
      retryCount: 0,
      probeMode: options.probeMode,
    };
  }

  async start(): Promise<void> {
    this.closing = false;
    if (this.options.probeMode === 'interval') {
      await this.runProbeCycle();
    } else {
      await this.connect();
    }
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
    if (this.options.probeMode === 'interval') {
      await this.runProbeCycle();
    } else {
      await this.connect();
    }
  }

  getStatus(): ServerStatus {
    return { ...this.status };
  }

  getRecentLog(): string[] {
    return [...this.recentLog];
  }

  private delayMs(ms: number): number {
    return jittered(ms, this.options.jitterRand ?? Math.random);
  }

  private recordLog(msg: string): void {
    this.recentLog.push(msg);
    if (this.recentLog.length > 20) {
      this.recentLog.shift();
    }
    this.log(msg);
  }

  /** After sleep/wake: probe/ping soon if connected, otherwise try a fresh cycle. */
  wakeUp(): void {
    if (this.closing) return;
    this.clearPingTimer();
    this.pingTimer = this.clock.setTimeout(() => {
      if (this.options.probeMode === 'interval') {
        this.retryCount = 0;
        void this.runProbeCycle();
      } else if (this.client) {
        void this.doPing();
      } else {
        this.retryCount = 0;
        void this.connect();
      }
    }, 500);
  }

  private async runProbeCycle(): Promise<void> {
    if (this.closing) return;
    this.recordLog(`[${this.name}] Probing (interval)...`);
    this.setStatus('connecting');

    let probeClient: MonitorClient | null = null;
    try {
      const { client, transport } = this.clientFactory(this.config, this.options);
      probeClient = client;
      await client.connect(transport);
      const start = this.clock.now();
      await client.ping({ timeout: this.options.pingTimeoutMs });
      const elapsed = this.clock.now() - start;
      await client.close().catch(() => {});
      probeClient = null;
      this.client = null;
      this.retryCount = 0;
      this.recordLog(`[${this.name}] Probe OK (${elapsed}ms)`);
      this.setStatus('healthy', {
        lastPingMs: elapsed,
        lastConnectedAt: new Date(this.clock.now()),
      });
      this.scheduleIntervalProbe();
    } catch (err) {
      if (probeClient) {
        await probeClient.close().catch(() => {});
      }
      this.client = null;
      const msg = err instanceof Error ? err.message : String(err);
      this.recordLog(`[${this.name}] Probe failed: ${msg}`);
      this.setStatus('degraded', { lastError: msg, lastFailedAt: new Date(this.clock.now()) });
      this.scheduleRetry();
    }
  }

  private scheduleIntervalProbe(): void {
    this.clearPingTimer();
    if (this.closing) return;
    this.pingTimer = this.clock.setTimeout(() => {
      void this.runProbeCycle();
    }, this.delayMs(this.options.pingIntervalMs));
  }

  private async connect(): Promise<void> {
    this.recordLog(`[${this.name}] Connecting...`);
    this.setStatus('connecting');

    try {
      const { client, transport } = this.clientFactory(this.config, this.options);
      await client.connect(transport);

      this.client = client;
      this.retryCount = 0;
      this.recordLog(`[${this.name}] Connected`);
      this.setStatus('healthy', { lastConnectedAt: new Date(this.clock.now()) });
      this.schedulePing();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.recordLog(`[${this.name}] Connection failed: ${msg}`);
      this.setStatus('failed', { lastError: msg, lastFailedAt: new Date(this.clock.now()) });
      this.scheduleRetry();
    }
  }

  private schedulePing(): void {
    this.clearPingTimer();
    if (this.closing) return;

    this.pingTimer = this.clock.setTimeout(() => {
      void this.doPing();
    }, this.delayMs(this.options.pingIntervalMs));
  }

  private async doPing(): Promise<void> {
    if (!this.client || this.closing) return;

    const start = this.clock.now();
    try {
      await this.client.ping({ timeout: this.options.pingTimeoutMs });
      const elapsed = this.clock.now() - start;
      this.recordLog(`[${this.name}] Ping OK (${elapsed}ms)`);
      this.setStatus('healthy', { lastPingMs: elapsed });
      this.schedulePing();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.recordLog(`[${this.name}] Ping failed: ${msg}`);
      this.setStatus('degraded', { lastError: msg });

      await this.client.close().catch(() => {});
      this.client = null;
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    if (this.closing) return;
    if (this.retryCount >= this.options.maxRetries) {
      this.recordLog(`[${this.name}] Max retries (${this.options.maxRetries}) reached. Giving up.`);
      this.setStatus('failed', { lastError: 'Max retries exceeded' });
      return;
    }

    const delay = Math.min(
      this.options.initialBackoffMs * Math.pow(this.options.backoffMultiplier, this.retryCount),
      this.options.maxBackoffMs,
    );
    this.retryCount++;
    this.log(
      `[${this.name}] Retry ${this.retryCount}/${this.options.maxRetries} in ${Math.round(delay)}ms`,
    );
    this.setStatus('degraded');

    const retryFn =
      this.options.probeMode === 'interval'
        ? () => void this.runProbeCycle()
        : () => void this.connect();
    this.pingTimer = this.clock.setTimeout(retryFn, this.delayMs(delay));
  }

  private clearPingTimer(): void {
    if (this.pingTimer) {
      this.clock.clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private setStatus(state: ServerState, extra?: Partial<ServerStatus>): void {
    this.status = {
      ...this.status,
      state,
      retryCount: this.retryCount,
      probeMode: this.options.probeMode,
      ...extra,
    };
    this.onStatusChange({ ...this.status });
  }
}
