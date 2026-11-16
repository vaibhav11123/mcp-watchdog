import * as fs from 'fs';
import * as path from 'path';

export const MUTATE_WINDOW_MS = 5 * 60 * 1000;
export const MUTATE_MAX = 3;

export interface MutateWindowState {
  /** Epoch ms of recent mutate ops (no secrets). */
  timestamps: number[];
}

function windowPath(cwd: string): string {
  return path.join(cwd, '.mcp-watchdog', 'mutate-window.json');
}

export function readMutateWindow(cwd: string): MutateWindowState {
  const file = windowPath(cwd);
  if (!fs.existsSync(file)) return { timestamps: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as MutateWindowState;
    const timestamps = Array.isArray(raw.timestamps)
      ? raw.timestamps.filter((t) => typeof t === 'number')
      : [];
    return { timestamps };
  } catch {
    return { timestamps: [] };
  }
}

export function pruneMutateWindow(
  state: MutateWindowState,
  nowMs: number,
  windowMs = MUTATE_WINDOW_MS,
): number[] {
  const cutoff = nowMs - windowMs;
  return state.timestamps.filter((t) => t >= cutoff);
}

/** True if another mutate is allowed under the sliding window. */
export function canMutate(
  cwd: string,
  nowMs = Date.now(),
  opts?: { max?: number; windowMs?: number },
): { ok: true; remaining: number } | { ok: false; reason: 'rate_limited'; count: number } {
  const max = opts?.max ?? MUTATE_MAX;
  const windowMs = opts?.windowMs ?? MUTATE_WINDOW_MS;
  const active = pruneMutateWindow(readMutateWindow(cwd), nowMs, windowMs);
  if (active.length >= max) {
    return { ok: false, reason: 'rate_limited', count: active.length };
  }
  return { ok: true, remaining: max - active.length };
}

export function recordMutate(cwd: string, nowMs = Date.now(), opts?: { windowMs?: number }): void {
  const windowMs = opts?.windowMs ?? MUTATE_WINDOW_MS;
  const dir = path.join(cwd, '.mcp-watchdog');
  fs.mkdirSync(dir, { recursive: true });
  const active = pruneMutateWindow(readMutateWindow(cwd), nowMs, windowMs);
  active.push(nowMs);
  fs.writeFileSync(windowPath(cwd), JSON.stringify({ timestamps: active }), 'utf8');
}
