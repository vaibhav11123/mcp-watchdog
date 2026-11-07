import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import {
  computeToolsFingerprint,
  diffTools,
  toolsSnapshotHash,
  type ToolDefinition,
} from '../packages/probe-core/src/index';
import { classifyProbeError } from './authError';
import type { McpServerConfig } from './config-core';
import { jittered, type MonitorOptions } from './options';
import { probeHttpEndpoint } from './passiveHttp';
import { redactLogTail, redactSecrets } from './secretRedact';

export type ServerState = 'connecting' | 'healthy' | 'degraded' | 'failed' | 'disconnected';

export interface ServerStatus {
  name: string;
  state: ServerState;
  lastPingMs?: number;
  lastError?: string;
  /**
   * Last classified/raw probe error before max-retries overwrite.
   * Used by Fix triage when lastError is only "Max retries exceeded".
   */
  lastProbeError?: string;
  /** Last few probe log lines on failure (secret-safe; never env/header values). */
  failureContext?: string;
  /** True when this failure was acknowledged (presentation only — set by UI layer). */
  accepted?: boolean;
  /** SecretStorage credential present; editor mcp.json may still lack the key. */
  watchdogOnlyCred?: boolean;
  /** Present when checkEmptyTools / detectToolDrift ran after a successful ping. */
  toolCount?: number;
  /** True when tool-name fingerprint changed vs the previous successful listTools. */
  toolDrift?: boolean;
  /** Human note for tool drift toast (not an error — keep out of lastError). */
  toolDriftNote?: string;
  /** True when schema hash changed; severity from diffTools (breaking vs info). */
  schemaDrift?: boolean;
  /** Highest schema change severity when schemaDrift is set. */
  schemaDriftSeverity?: 'breaking' | 'info' | 'patch';
  retryCount: number;
  lastConnectedAt?: Date;
  lastFailedAt?: Date;
  disabled?: boolean;
  probeMode?: MonitorOptions['probeMode'];
  /** Last Fix verifyRecovery outcome (Phase 3); presentation only. */
  verifiedOutcome?: 'resolved' | 'unresolved' | 'unknown' | 'worsened';
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
  listTools?: () => Promise<{ tools: unknown[] }>;
  callTool?: (args: {
    name: string;
    arguments?: Record<string, unknown>;
  }) => Promise<{ isError?: boolean; content?: unknown }>;
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

export { computeToolsFingerprint };

function defaultClientFactory(
  config: McpServerConfig,
  options: MonitorOptions,
): {
  client: MonitorClient;
  transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport;
} {
  const client = new Client({ name: 'mcp-watchdog', version: '1.0.0' }, { capabilities: {} });
  let transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport;
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
    if (config.type === 'sse') {
      transport = new SSEClientTransport(new URL(config.url), {
        ...(requestInit ? { requestInit } : {}),
      });
    } else {
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
  }
  return { client: client as unknown as MonitorClient, transport };
}

function attachStderrCapture(transport: unknown, onLine: (line: string) => void): void {
  const t = transport as { stderr?: NodeJS.ReadableStream | null };
  const stream = t.stderr;
  if (!stream || typeof stream.on !== 'function') return;
  stream.on('data', (chunk: Buffer | string) => {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    for (const line of text.split(/\r?\n/)) {
      if (line.trim()) onLine(line);
    }
  });
}

export class ServerMonitor {
  private client: MonitorClient | null = null;
  private pingTimer: ReturnType<typeof setTimeout> | null = null;
  private status: ServerStatus;
  private retryCount = 0;
  private closing = false;
  private readonly recentLog: string[] = [];
  private lastToolFingerprint: string | undefined;
  private lastToolCount: number | undefined;
  private lastSchemaHash: string | undefined;
  private lastToolsSnapshot: ToolDefinition[] | undefined;

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
    const safe = redactSecrets(msg);
    this.recentLog.push(safe);
    if (this.recentLog.length > 40) {
      this.recentLog.shift();
    }
    this.log(safe);
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

  private failureContextFromLog(): string {
    return redactLogTail(this.recentLog, 40, 8192);
  }

  /** Opt-in credential check after a successful ping/listTools. */
  private async maybeAuthProbe(client: MonitorClient): Promise<string | undefined> {
    const probe = this.options.authProbe;
    if (!probe?.tool || !client.callTool) return undefined;
    try {
      const result = await client.callTool({
        name: probe.tool,
        arguments: probe.arguments ?? {},
      });
      if (result.isError) {
        return 'Auth probe failed';
      }
      return undefined;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.recordLog(`[${this.name}] authProbe failed: ${msg}`);
      return 'Auth probe failed';
    }
  }

  private wantsListTools(): boolean {
    return !!(this.options.checkEmptyTools || this.options.detectToolDrift);
  }

  private async maybeListTools(client: MonitorClient): Promise<{
    toolCount?: number;
    toolDrift?: boolean;
    driftNote?: string;
    schemaDrift?: boolean;
    schemaDriftSeverity?: 'breaking' | 'info' | 'patch';
  }> {
    if (!this.wantsListTools() || !client.listTools) return {};
    try {
      const result = await client.listTools();
      const tools = Array.isArray(result.tools) ? result.tools : [];
      const { fingerprint, count } = computeToolsFingerprint(tools);
      this.recordLog(`[${this.name}] tools/list → ${count} tool(s)`);

      let toolDrift = false;
      let driftNote: string | undefined;
      if (this.lastToolFingerprint !== undefined && this.lastToolFingerprint !== fingerprint) {
        toolDrift = true;
        const prev = this.lastToolCount ?? 0;
        driftNote = `Tools changed (${prev} → ${count})`;
        this.recordLog(`[${this.name}] ${driftNote}`);
      }
      this.lastToolFingerprint = fingerprint;
      this.lastToolCount = count;

      const asDefs = tools as ToolDefinition[];
      const hash = toolsSnapshotHash(asDefs);
      let schemaDrift = false;
      let schemaDriftSeverity: 'breaking' | 'info' | 'patch' | undefined;
      if (this.lastSchemaHash !== undefined && this.lastSchemaHash !== hash) {
        schemaDrift = true;
        const diff = diffTools(this.lastToolsSnapshot ?? [], asDefs);
        if (diff.breaking.length) schemaDriftSeverity = 'breaking';
        else if (diff.info.length) schemaDriftSeverity = 'info';
        else schemaDriftSeverity = 'patch';
        this.recordLog(`[${this.name}] schema drift (${schemaDriftSeverity})`);
      }
      this.lastSchemaHash = hash;
      this.lastToolsSnapshot = asDefs;

      return { toolCount: count, toolDrift, driftNote, schemaDrift, schemaDriftSeverity };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.recordLog(`[${this.name}] tools/list failed: ${msg}`);
      return {};
    }
  }

  private async runPassiveHttpProbe(): Promise<boolean> {
    if (!this.options.passiveHttpProbe || this.config.type !== 'http') return false;
    const result = await probeHttpEndpoint(
      this.config.url,
      this.options.passiveHttpFetch,
      this.config.headers,
    );
    if (result.reachable) {
      this.recordLog(
        `[${this.name}] Passive HTTP OK${result.status !== undefined ? ` (HTTP ${result.status})` : ''}`,
      );
      return true;
    }
    this.recordLog(
      `[${this.name}] Passive HTTP unreachable${result.error ? `: ${result.error}` : result.status !== undefined ? ` (HTTP ${result.status})` : ''}`,
    );
    return false;
  }

  private async runProbeCycle(): Promise<void> {
    if (this.closing) return;
    this.recordLog(`[${this.name}] Probing (interval)...`);
    this.setStatus('connecting');

    const endpointReachable = await this.runPassiveHttpProbe();

    let probeClient: MonitorClient | null = null;
    try {
      const { client, transport } = this.clientFactory(this.config, this.options);
      probeClient = client;
      await client.connect(transport);
      attachStderrCapture(transport, (line) => this.recordLog(`[${this.name}] stderr: ${line}`));
      const start = this.clock.now();
      await client.ping({ timeout: this.options.pingTimeoutMs });
      const elapsed = this.clock.now() - start;
      const listed = await this.maybeListTools(client);
      this.retryCount = 0;
      this.recordLog(`[${this.name}] Probe OK (${elapsed}ms)`);
      const authFail = await this.maybeAuthProbe(client);
      await client.close().catch(() => {});
      probeClient = null;
      this.client = null;
      if (authFail) {
        this.setStatus('degraded', {
          lastPingMs: elapsed,
          lastError: authFail,
          lastProbeError: authFail,
          lastFailedAt: new Date(this.clock.now()),
          failureContext: this.failureContextFromLog(),
          toolCount: listed.toolCount,
          toolDrift: false,
        });
        this.scheduleRetry();
        return;
      }
      // Do not put drift notes in lastError — UI treats lastError as a failure string.
      this.setStatus('healthy', {
        lastPingMs: elapsed,
        lastConnectedAt: new Date(this.clock.now()),
        lastError: undefined,
        lastProbeError: undefined,
        failureContext: undefined,
        toolCount: listed.toolCount,
        toolDrift: listed.toolDrift === true,
        toolDriftNote: listed.driftNote,
        schemaDrift: listed.schemaDrift === true,
        schemaDriftSeverity: listed.schemaDriftSeverity,
      });
      this.scheduleIntervalProbe();
    } catch (err) {
      if (probeClient) {
        await probeClient.close().catch(() => {});
      }
      this.client = null;
      const msg = err instanceof Error ? err.message : String(err);
      const classified = classifyProbeError(msg);
      const lastError = endpointReachable
        ? `MCP session failed but endpoint reachable: ${classified}`
        : classified;
      this.recordLog(`[${this.name}] Probe failed: ${msg}`);
      this.setStatus('degraded', {
        lastError,
        lastProbeError: lastError,
        lastFailedAt: new Date(this.clock.now()),
        failureContext: this.failureContextFromLog(),
        toolDrift: false,
      });
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
      attachStderrCapture(transport, (line) => this.recordLog(`[${this.name}] stderr: ${line}`));

      this.client = client;
      this.retryCount = 0;
      this.recordLog(`[${this.name}] Connected`);
      this.setStatus('healthy', {
        lastConnectedAt: new Date(this.clock.now()),
        lastError: undefined,
        lastProbeError: undefined,
        toolDrift: false,
      });
      this.schedulePing();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const lastError = classifyProbeError(msg);
      this.recordLog(`[${this.name}] Connection failed: ${msg}`);
      this.setStatus('failed', {
        lastError,
        lastProbeError: lastError,
        lastFailedAt: new Date(this.clock.now()),
        failureContext: this.failureContextFromLog(),
        toolDrift: false,
      });
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
    const client = this.client;
    if (!client || this.closing) return;

    const start = this.clock.now();
    try {
      await client.ping({ timeout: this.options.pingTimeoutMs });
      const elapsed = this.clock.now() - start;
      const listed = await this.maybeListTools(client);
      this.recordLog(`[${this.name}] Ping OK (${elapsed}ms)`);
      const authFail = await this.maybeAuthProbe(client);
      if (authFail) {
        this.setStatus('degraded', {
          lastPingMs: elapsed,
          lastError: authFail,
          lastProbeError: authFail,
          failureContext: this.failureContextFromLog(),
          toolCount: listed.toolCount,
          toolDrift: false,
        });
        await client.close().catch(() => {});
        this.client = null;
        this.scheduleRetry();
        return;
      }
      this.setStatus('healthy', {
        lastPingMs: elapsed,
        lastError: undefined,
        lastProbeError: undefined,
        failureContext: undefined,
        toolCount: listed.toolCount,
        toolDrift: listed.toolDrift === true,
        toolDriftNote: listed.driftNote,
        schemaDrift: listed.schemaDrift === true,
        schemaDriftSeverity: listed.schemaDriftSeverity,
      });
      this.schedulePing();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const lastError = classifyProbeError(msg);
      this.recordLog(`[${this.name}] Ping failed: ${msg}`);
      this.setStatus('degraded', {
        lastError,
        lastProbeError: lastError,
        failureContext: this.failureContextFromLog(),
        toolDrift: false,
      });

      await client.close().catch(() => {});
      this.client = null;
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    if (this.closing) return;
    if (this.retryCount >= this.options.maxRetries) {
      this.recordLog(`[${this.name}] Max retries (${this.options.maxRetries}) reached. Giving up.`);
      this.setStatus('failed', {
        lastError: 'Max retries exceeded',
        lastProbeError: this.status.lastProbeError ?? this.status.lastError,
        failureContext: this.failureContextFromLog(),
      });
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
