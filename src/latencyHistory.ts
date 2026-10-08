const DEFAULT_MAX_SAMPLES = 40;

/**
 * Per-server ring of recent successful ping latencies (ms) for Overview sparklines.
 * vscode-free — persist optionally via onChange callback.
 */
export class LatencyHistory {
  private readonly byServer = new Map<string, number[]>();

  constructor(
    private readonly maxSamples = DEFAULT_MAX_SAMPLES,
    private readonly onChange?: (server: string, samples: number[]) => void,
  ) {}

  /** Push a sample when a healthy ping reports lastPingMs. */
  push(server: string, lastPingMs: number): void {
    if (!Number.isFinite(lastPingMs) || lastPingMs < 0) return;
    let ring = this.byServer.get(server);
    if (!ring) {
      ring = [];
      this.byServer.set(server, ring);
    }
    ring.push(lastPingMs);
    while (ring.length > this.maxSamples) {
      ring.shift();
    }
    this.onChange?.(server, [...ring]);
  }

  get(server: string): number[] {
    return [...(this.byServer.get(server) ?? [])];
  }

  /** Snapshot for Overview: server → samples (oldest → newest). */
  snapshot(): Record<string, number[]> {
    const out: Record<string, number[]> = {};
    for (const [name, samples] of this.byServer) {
      out[name] = [...samples];
    }
    return out;
  }

  clear(server?: string): void {
    if (server) {
      this.byServer.delete(server);
    } else {
      this.byServer.clear();
    }
  }

  serverCount(): number {
    return this.byServer.size;
  }
}

/**
 * Build a compact SVG sparkline polyline from latency samples (ms).
 * Returns empty string when fewer than 2 samples.
 */
export function sparklineSvg(samples: number[], width = 64, height = 16): string {
  if (samples.length < 2) return '';

  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const range = max - min || 1;
  const n = samples.length;
  const pad = 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const points = samples
    .map((v, i) => {
      const x = pad + (i / (n - 1)) * innerW;
      const y = pad + innerH - ((v - min) / range) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false"><polyline fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" points="${points}"/></svg>`;
}
