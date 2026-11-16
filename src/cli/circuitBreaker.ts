import * as fs from 'fs';
import * as path from 'path';

export const CIRCUIT_WINDOW_MS = 10 * 60 * 1000;
export const CIRCUIT_FAIL_THRESHOLD = 2;

export interface CircuitEntry {
  causeId: string;
  stepId: string;
  /** Epoch ms of recent failures. */
  fails: number[];
}

export interface CircuitState {
  entries: CircuitEntry[];
}

function circuitPath(cwd: string): string {
  return path.join(cwd, '.mcp-watchdog', 'circuit.json');
}

function keyOf(causeId: string, stepId: string): string {
  return `${causeId}\0${stepId}`;
}

export function readCircuit(cwd: string): CircuitState {
  const file = circuitPath(cwd);
  if (!fs.existsSync(file)) return { entries: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as CircuitState;
    const entries = Array.isArray(raw.entries)
      ? raw.entries.filter(
          (e) =>
            e &&
            typeof e.causeId === 'string' &&
            typeof e.stepId === 'string' &&
            Array.isArray(e.fails),
        )
      : [];
    return { entries };
  } catch {
    return { entries: [] };
  }
}

function writeCircuit(cwd: string, state: CircuitState): void {
  const dir = path.join(cwd, '.mcp-watchdog');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(circuitPath(cwd), JSON.stringify(state), 'utf8');
}

function pruneFails(fails: number[], nowMs: number, windowMs: number): number[] {
  const cutoff = nowMs - windowMs;
  return fails.filter((t) => typeof t === 'number' && t >= cutoff);
}

export function isCircuitOpen(
  cwd: string,
  causeId: string,
  stepId: string,
  nowMs = Date.now(),
  opts?: { threshold?: number; windowMs?: number },
): boolean {
  const threshold = opts?.threshold ?? CIRCUIT_FAIL_THRESHOLD;
  const windowMs = opts?.windowMs ?? CIRCUIT_WINDOW_MS;
  const state = readCircuit(cwd);
  const entry = state.entries.find((e) => e.causeId === causeId && e.stepId === stepId);
  if (!entry) return false;
  return pruneFails(entry.fails, nowMs, windowMs).length >= threshold;
}

export function recordCircuitFailure(
  cwd: string,
  causeId: string,
  stepId: string,
  nowMs = Date.now(),
  opts?: { windowMs?: number },
): { open: boolean; failCount: number } {
  const windowMs = opts?.windowMs ?? CIRCUIT_WINDOW_MS;
  const state = readCircuit(cwd);
  const idx = state.entries.findIndex((e) => e.causeId === causeId && e.stepId === stepId);
  const prev = idx >= 0 ? state.entries[idx]! : { causeId, stepId, fails: [] as number[] };
  const fails = pruneFails(prev.fails, nowMs, windowMs);
  fails.push(nowMs);
  const next: CircuitEntry = { causeId, stepId, fails };
  if (idx >= 0) state.entries[idx] = next;
  else state.entries.push(next);
  // Drop empty/expired entries
  state.entries = state.entries
    .map((e) => ({ ...e, fails: pruneFails(e.fails, nowMs, windowMs) }))
    .filter((e) => e.fails.length > 0 || keyOf(e.causeId, e.stepId) === keyOf(causeId, stepId));
  writeCircuit(cwd, state);
  const failCount = fails.length;
  return { open: failCount >= CIRCUIT_FAIL_THRESHOLD, failCount };
}

export function clearCircuit(
  cwd: string,
  causeId: string,
  stepId: string,
  nowMs = Date.now(),
  opts?: { windowMs?: number },
): void {
  const windowMs = opts?.windowMs ?? CIRCUIT_WINDOW_MS;
  const state = readCircuit(cwd);
  state.entries = state.entries
    .filter((e) => !(e.causeId === causeId && e.stepId === stepId))
    .map((e) => ({ ...e, fails: pruneFails(e.fails, nowMs, windowMs) }))
    .filter((e) => e.fails.length > 0);
  writeCircuit(cwd, state);
}
