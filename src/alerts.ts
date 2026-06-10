import type { ServerStatus } from './monitor';

export type NotifyMode = 'all' | 'failures' | 'none';

export type AlertKind = 'error' | 'warning' | 'info' | 'flap';

export interface AlertDecision {
  kind: AlertKind;
  server: string;
  message: string;
  actions: string[];
}

export interface MuteState {
  muteUntil: number;
}

export interface FlapState {
  failureTimes: number[];
  flapping: boolean;
  flapAlertSent: boolean;
}

const FLAP_WINDOW_MS = 10 * 60 * 1000;
const FLAP_THRESHOLD = 3;
const DEFAULT_DEGRADED_ALERT_DELAY_MS = 60_000;

export function decideAlert(
  prev: ServerStatus | undefined,
  next: ServerStatus,
  mute: MuteState | undefined,
  notify: NotifyMode,
  now: number,
  flap: FlapState,
  degradedSince?: number,
  degradedAlertDelayMs = DEFAULT_DEGRADED_ALERT_DELAY_MS,
): { alert?: AlertDecision; flap: FlapState; degradedSince?: number } {
  const outFlap = { ...flap, failureTimes: [...flap.failureTimes] };

  if (notify === 'none' || next.disabled) {
    return { flap: outFlap, degradedSince };
  }

  if (mute && mute.muteUntil > now) {
    return { flap: outFlap, degradedSince };
  }

  const prevState = prev?.state;
  const nextState = next.state;

  if (nextState === 'healthy' && (prevState === 'degraded' || prevState === 'failed')) {
    outFlap.failureTimes = [];
    outFlap.flapping = false;
    outFlap.flapAlertSent = false;
    if (notify === 'all') {
      return {
        alert: {
          kind: 'info',
          server: next.name,
          message: `MCP server ${next.name} recovered`,
          actions: [],
        },
        flap: outFlap,
        degradedSince: undefined,
      };
    }
    return { flap: outFlap, degradedSince: undefined };
  }

  const isFailureTransition =
    (prevState === 'healthy' || prevState === 'connecting') &&
    (nextState === 'degraded' || nextState === 'failed');

  if (isFailureTransition) {
    outFlap.failureTimes.push(now);
    outFlap.failureTimes = outFlap.failureTimes.filter((t) => now - t <= FLAP_WINDOW_MS);
    if (outFlap.failureTimes.length > FLAP_THRESHOLD) {
      outFlap.flapping = true;
      if (!outFlap.flapAlertSent) {
        outFlap.flapAlertSent = true;
        return {
          alert: {
            kind: 'flap',
            server: next.name,
            message: `MCP server ${next.name} is flapping (${outFlap.failureTimes.length} failures in 10m)`,
            actions: ['Show Log', 'Mute 1h'],
          },
          flap: outFlap,
          degradedSince: now,
        };
      }
      return { flap: outFlap, degradedSince: now };
    }
    if (outFlap.flapping) {
      return { flap: outFlap, degradedSince: now };
    }
  }

  if (prevState === 'healthy' && nextState === 'degraded') {
    return { flap: outFlap, degradedSince: degradedSince ?? now };
  }

  if (
    nextState === 'degraded' &&
    degradedSince !== undefined &&
    now - degradedSince >= degradedAlertDelayMs &&
    !outFlap.flapping
  ) {
    return {
      alert: {
        kind: 'warning',
        server: next.name,
        message: `MCP server ${next.name} degraded: ${next.lastError ?? 'unreachable'}`,
        actions: ['Reconnect', 'Show Log', 'Reload Window', 'Mute 1h'],
      },
      flap: outFlap,
      degradedSince,
    };
  }

  if (
    (prevState === 'healthy' || prevState === 'connecting') &&
    nextState === 'failed' &&
    !outFlap.flapping
  ) {
    return {
      alert: {
        kind: 'error',
        server: next.name,
        message: `MCP server ${next.name} failed: ${next.lastError ?? 'unknown'}`,
        actions: ['Reconnect', 'Show Log', 'Reload Window', 'Mute 1h'],
      },
      flap: outFlap,
      degradedSince: undefined,
    };
  }

  if (outFlap.flapping && outFlap.failureTimes.every((t) => now - t > FLAP_WINDOW_MS)) {
    outFlap.flapping = false;
    outFlap.flapAlertSent = false;
    outFlap.failureTimes = [];
  }

  return { flap: outFlap, degradedSince };
}

export class AlertManager {
  private prev = new Map<string, ServerStatus>();
  private mutes = new Map<string, MuteState>();
  private flaps = new Map<string, FlapState>();
  private degradedSince = new Map<string, number>();
  private degradedTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly notify: () => NotifyMode,
    private readonly emit: (decision: AlertDecision) => void,
    private readonly now: () => number = () => Date.now(),
    private readonly degradedAlertDelayMs: () => number = () => DEFAULT_DEGRADED_ALERT_DELAY_MS,
  ) {}

  onStatusChange(status: ServerStatus): void {
    const name = status.name;
    const prev = this.prev.get(name);
    const withFlap: ServerStatus = {
      ...status,
      flapping: this.flaps.get(name)?.flapping ?? false,
    };

    const result = decideAlert(
      prev,
      withFlap,
      this.mutes.get(name),
      this.notify(),
      this.now(),
      this.flaps.get(name) ?? { failureTimes: [], flapping: false, flapAlertSent: false },
      this.degradedSince.get(name),
      this.degradedAlertDelayMs(),
    );

    this.flaps.set(name, result.flap);
    if (result.degradedSince !== undefined) {
      this.degradedSince.set(name, result.degradedSince);
    } else if (status.state === 'healthy') {
      this.degradedSince.delete(name);
    }

    if (result.alert) {
      const mode = this.notify();
      if (result.alert.kind === 'info' && mode !== 'all') {
        // skip recovery toasts unless notify=all
      } else {
        this.emit(result.alert);
      }
    }

    if (status.state === 'degraded' && prev?.state === 'healthy') {
      this.scheduleDegradedCheck(name);
    }
    if (status.state === 'healthy') {
      this.clearDegradedTimer(name);
    }

    this.prev.set(name, { ...withFlap, flapping: result.flap.flapping });
  }

  mute(server: string, durationMs: number): void {
    this.mutes.set(server, { muteUntil: this.now() + durationMs });
  }

  isMuted(server: string): boolean {
    const m = this.mutes.get(server);
    return m !== undefined && m.muteUntil > this.now();
  }

  getFlapping(server: string): boolean {
    return this.flaps.get(server)?.flapping ?? false;
  }

  clearServer(name: string): void {
    this.prev.delete(name);
    this.degradedSince.delete(name);
    this.clearDegradedTimer(name);
  }

  private scheduleDegradedCheck(name: string): void {
    this.clearDegradedTimer(name);
    this.degradedTimers.set(
      name,
      setTimeout(() => {
        const prev = this.prev.get(name);
        if (!prev || prev.state !== 'degraded') return;
        const result = decideAlert(
          prev,
          prev,
          this.mutes.get(name),
          this.notify(),
          this.now(),
          this.flaps.get(name) ?? { failureTimes: [], flapping: false, flapAlertSent: false },
          this.degradedSince.get(name),
          this.degradedAlertDelayMs(),
        );
        if (result.alert) {
          this.emit(result.alert);
        }
      }, this.degradedAlertDelayMs()),
    );
  }

  private clearDegradedTimer(name: string): void {
    const t = this.degradedTimers.get(name);
    if (t) clearTimeout(t);
    this.degradedTimers.delete(name);
  }
}
