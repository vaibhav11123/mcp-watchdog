import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import {
  CAPTURE_PATH,
  FETCH_TIMEOUT_MS,
  INSTALL_ID_KEY,
  POSTHOG_API_KEY,
  POSTHOG_HOST,
  SETTING_ENABLED,
  STATE_TRANSITION_MIN_MS,
  TELEMETRY_NOTICE_KEY,
} from './config';
import type { EventPropsMap, TelemetryEventName } from './events';
import { isAllowedEvent, materializeCaptureProperties, scrubProperties } from './scrub';

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number }>;

export interface CanSendInput {
  watchdogEnabled: boolean;
  vscodeTelemetryEnabled: boolean;
  extensionMode: vscode.ExtensionMode;
  apiKey: string;
  /** Force-send in Development when set. */
  debugEnv?: string | undefined;
}

export function canSend(input: CanSendInput): boolean {
  if (!input.apiKey.trim()) return false;
  if (!input.watchdogEnabled) return false;
  if (!input.vscodeTelemetryEnabled) return false;
  if (input.extensionMode === vscode.ExtensionMode.Test) return false;
  if (input.extensionMode === vscode.ExtensionMode.Development) {
    if (input.debugEnv !== '1') return false;
  }
  return true;
}

export interface CaptureBody {
  api_key: string;
  distinct_id: string;
  event: string;
  properties: Record<string, unknown>;
  timestamp?: string;
}

/** Client-side validation — PostHog may return 200 and still drop bad events. */
export function buildCaptureBody(input: {
  apiKey: string;
  distinctId: string;
  event: string;
  properties: Record<string, unknown>;
}): CaptureBody | undefined {
  const apiKey = input.apiKey.trim();
  const distinctId = input.distinctId.trim().slice(0, 200);
  const event = input.event.trim();
  if (!apiKey || !distinctId || !event) return undefined;
  if (!isAllowedEvent(event)) return undefined;
  return {
    api_key: apiKey,
    distinct_id: distinctId,
    event,
    properties: input.properties,
    timestamp: new Date().toISOString(),
  };
}

export async function postCapture(
  host: string,
  body: CaptureBody,
  fetchImpl: FetchLike = fetch as FetchLike,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<void> {
  const base = host.replace(/\/$/, '');
  const url = `${base}${CAPTURE_PATH}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    /* fail-soft */
  } finally {
    clearTimeout(timer);
  }
}

export class StateTransitionRateLimit {
  private last = new Map<string, number>();

  constructor(private readonly minMs = STATE_TRANSITION_MIN_MS) {}

  /** Returns true if the transition may be sent. */
  allow(serverKey: string, now = Date.now()): boolean {
    const prev = this.last.get(serverKey);
    if (prev !== undefined && now - prev < this.minMs) return false;
    this.last.set(serverKey, now);
    return true;
  }

  clear(): void {
    this.last.clear();
  }
}

let contextRef: vscode.ExtensionContext | undefined;
let logger: vscode.TelemetryLogger | undefined;
let installId: string | undefined;
let fetchImpl: FetchLike = fetch as FetchLike;
let apiKeyOverride: string | undefined;
let hostOverride: string | undefined;
const rateLimit = new StateTransitionRateLimit();
let configListener: vscode.Disposable | undefined;
let vscodeTelListener: vscode.Disposable | undefined;

function resolveApiKey(): string {
  return (apiKeyOverride ?? POSTHOG_API_KEY).trim();
}

function resolveHost(): string {
  return (hostOverride ?? POSTHOG_HOST).replace(/\/$/, '');
}

function watchdogEnabled(): boolean {
  return vscode.workspace.getConfiguration('mcpWatchdog').get<boolean>(SETTING_ENABLED, true);
}

export function getInstallId(): string | undefined {
  return installId;
}

export function setFetchForTests(fn: FetchLike | undefined): void {
  fetchImpl = fn ?? (fetch as FetchLike);
}

export function setCredentialsForTests(apiKey?: string, host?: string): void {
  apiKeyOverride = apiKey;
  hostOverride = host;
}

export function resetTelemetryForTests(): void {
  dispose();
  contextRef = undefined;
  installId = undefined;
  apiKeyOverride = undefined;
  hostOverride = undefined;
  fetchImpl = fetch as FetchLike;
  rateLimit.clear();
}

function ensureInstallId(context: vscode.ExtensionContext): string {
  const existing = context.globalState.get<string>(INSTALL_ID_KEY);
  if (existing && existing.length > 0) {
    installId = existing;
    return existing;
  }
  const id = randomUUID();
  void context.globalState.update(INSTALL_ID_KEY, id);
  installId = id;
  return id;
}

class PostHogSender implements vscode.TelemetrySender {
  sendEventData(eventName: string, data?: Record<string, unknown>): void {
    const ctx = contextRef;
    if (!ctx) return;
    if (
      !canSend({
        watchdogEnabled: watchdogEnabled(),
        vscodeTelemetryEnabled: vscode.env.isTelemetryEnabled,
        extensionMode: ctx.extensionMode,
        apiKey: resolveApiKey(),
        debugEnv: process.env.MCP_WATCHDOG_TELEMETRY_DEBUG,
      })
    ) {
      return;
    }
    const id = installId ?? ensureInstallId(ctx);
    const scrubbed = scrubProperties(data);
    const body = buildCaptureBody({
      apiKey: resolveApiKey(),
      distinctId: id,
      event: eventName,
      properties: materializeCaptureProperties(scrubbed),
    });
    if (!body) return;
    void postCapture(resolveHost(), body, fetchImpl);
  }

  sendErrorData(error: Error, data?: Record<string, unknown>): void {
    this.sendEventData('error', {
      where: typeof data?.where === 'string' ? data.where : 'unknown',
      name: error.name || 'Error',
    });
  }
}

export function init(context: vscode.ExtensionContext): void {
  dispose();
  contextRef = context;
  ensureInstallId(context);
  const sender = new PostHogSender();
  logger = vscode.env.createTelemetryLogger(sender, {
    ignoreBuiltInCommonProperties: true,
  });
  context.subscriptions.push(logger);

  configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('mcpWatchdog.telemetry.enabled')) {
      const enabled = watchdogEnabled();
      track('settings_change', { key: 'telemetry.enabled', value: enabled });
    }
    if (e.affectsConfiguration('mcpWatchdog.cloudBridge.enabled')) {
      const enabled = vscode.workspace
        .getConfiguration('mcpWatchdog')
        .get<boolean>('cloudBridge.enabled', false);
      track('settings_change', { key: 'cloudBridge.enabled', value: enabled });
    }
  });
  context.subscriptions.push(configListener);

  vscodeTelListener = vscode.env.onDidChangeTelemetryEnabled(() => {
    /* canSend re-reads isTelemetryEnabled on each track */
  });
  context.subscriptions.push(vscodeTelListener);

  void maybeShowFirstRunNotice(context);
}

async function maybeShowFirstRunNotice(context: vscode.ExtensionContext): Promise<void> {
  if (context.globalState.get<boolean>(TELEMETRY_NOTICE_KEY)) return;
  if (!watchdogEnabled()) {
    await context.globalState.update(TELEMETRY_NOTICE_KEY, true);
    return;
  }
  if (context.extensionMode === vscode.ExtensionMode.Test) {
    await context.globalState.update(TELEMETRY_NOTICE_KEY, true);
    return;
  }
  await context.globalState.update(TELEMETRY_NOTICE_KEY, true);
  const pick = await vscode.window.showInformationMessage(
    'MCP Watchdog shares anonymous product usage (activation, triage actions, failure classes) via PostHog. On by default; never sends env/header values or secrets. Also requires the editor’s telemetry setting.',
    'Disable',
    'Open Settings',
  );
  if (pick === 'Disable') {
    await vscode.workspace
      .getConfiguration('mcpWatchdog')
      .update(SETTING_ENABLED, false, vscode.ConfigurationTarget.Global);
  } else if (pick === 'Open Settings') {
    await vscode.commands.executeCommand(
      'workbench.action.openSettings',
      'mcpWatchdog.telemetry.enabled',
    );
  }
}

export function track<E extends TelemetryEventName>(
  event: E,
  props: EventPropsMap[E],
  opts?: { serverKey?: string },
): void {
  if (!contextRef || !logger) return;
  if (event === 'state_transition' && opts?.serverKey) {
    if (!rateLimit.allow(opts.serverKey)) return;
  }
  if (
    !canSend({
      watchdogEnabled: watchdogEnabled(),
      vscodeTelemetryEnabled: vscode.env.isTelemetryEnabled,
      extensionMode: contextRef.extensionMode,
      apiKey: resolveApiKey(),
      debugEnv: process.env.MCP_WATCHDOG_TELEMETRY_DEBUG,
    })
  ) {
    return;
  }
  // Flatten nested $set for TelemetryLogger (primitives only); sender rehydrates via scrub.
  const data: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props as unknown as Record<string, unknown>)) {
    if (k === '$set' || k === '$set_once') {
      if (v && typeof v === 'object') data[k] = JSON.stringify(v);
      continue;
    }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      data[k] = v;
    }
  }
  // Prefer logger.logUsage so VS Code applies enable states + Trace Output (never call sender directly).
  logger.logUsage(event, data);
}

export function trackError(where: string, err: unknown): void {
  const name = err instanceof Error ? err.name : 'Error';
  track('error', { where, name });
}

export function dispose(): void {
  try {
    logger?.dispose();
  } catch {
    /* ignore */
  }
  logger = undefined;
  try {
    configListener?.dispose();
  } catch {
    /* ignore */
  }
  configListener = undefined;
  try {
    vscodeTelListener?.dispose();
  } catch {
    /* ignore */
  }
  vscodeTelListener = undefined;
}
