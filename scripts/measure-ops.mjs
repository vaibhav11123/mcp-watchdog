/**
 * Measure reconnect latency, success rate, and concurrent probe capacity.
 * Uses the same Client + StdioClientTransport + ping path as ServerMonitor interval mode.
 * Fixture: mcp-watchdog-test/fixtures/echo-server.js (local, no npx cold start).
 *
 * Metrics:
 *  1. Median reconnect time — wall clock for forceReconnect-equivalent
 *     (close previous + connect + ping + close), N trials
 *  2. Reconnect success rate — successes / attempts
 *  3. Max concurrent monitored servers — largest N where N parallel probes all succeed
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ECHO = path.join(__dirname, '..', 'mcp-watchdog-test', 'fixtures', 'echo-server.js');
const PING_TIMEOUT_MS = 5_000;
const RECONNECT_TRIALS = 21;
const CONCURRENT_MAX_PROBE = Number(process.env.CONCURRENT_MAX || 128);
const CONCURRENT_TIMEOUT_MS = 30_000;

function median(nums) {
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 === 0 ? (a[mid - 1] + a[mid]) / 2 : a[mid];
}

function percentile(nums, p) {
  const a = [...nums].sort((x, y) => x - y);
  if (a.length === 0) return NaN;
  const idx = Math.min(a.length - 1, Math.max(0, Math.ceil((p / 100) * a.length) - 1));
  return a[idx];
}

async function probeOnce() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [ECHO],
  });
  const client = new Client({ name: 'mcp-watchdog-measure', version: '0.0.0' }, { capabilities: {} });
  const t0 = performance.now();
  try {
    await client.connect(transport);
    const pingStart = performance.now();
    await client.ping({ timeout: PING_TIMEOUT_MS });
    const pingMs = performance.now() - pingStart;
    await client.close().catch(() => {});
    return { ok: true, totalMs: performance.now() - t0, pingMs };
  } catch (err) {
    await client.close().catch(() => {});
    return {
      ok: false,
      totalMs: performance.now() - t0,
      pingMs: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** forceReconnect-equivalent: a full probe cycle after a prior healthy cycle. */
async function measureReconnectTrials(n) {
  // Warmup (excluded from stats) — first spawn can pay module-load cost
  await probeOnce();

  const times = [];
  let successes = 0;
  const errors = [];

  for (let i = 0; i < n; i++) {
    const r = await probeOnce();
    if (r.ok) {
      successes++;
      times.push(r.totalMs);
    } else {
      errors.push(r.error);
    }
  }

  return {
    trials: n,
    successes,
    failures: n - successes,
    successRate: successes / n,
    timesMs: times,
    medianMs: times.length ? median(times) : null,
    p95Ms: times.length ? percentile(times, 95) : null,
    minMs: times.length ? Math.min(...times) : null,
    maxMs: times.length ? Math.max(...times) : null,
    meanMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
    errors,
  };
}

async function allConcurrentSucceed(n) {
  const started = performance.now();
  const results = await Promise.all(
    Array.from({ length: n }, () => probeOnce()),
  );
  const elapsed = performance.now() - started;
  const ok = results.every((r) => r.ok);
  const successCount = results.filter((r) => r.ok).length;
  return { n, ok, successCount, elapsedMs: elapsed, results };
}

async function findMaxConcurrent() {
  let lo = 0;
  let hi = 1;
  const ladder = [];

  // Ramp until failure or CONCURRENT_MAX_PROBE
  while (hi <= CONCURRENT_MAX_PROBE) {
    const r = await allConcurrentSucceed(hi);
    ladder.push({ n: hi, ok: r.ok, successCount: r.successCount, elapsedMs: Math.round(r.elapsedMs) });
    if (!r.ok || r.elapsedMs > CONCURRENT_TIMEOUT_MS) {
      break;
    }
    lo = hi;
    hi = hi === 1 ? 2 : hi * 2;
  }

  if (lo === 0 && hi === 1) {
    // even 1 failed
    return { maxConcurrent: 0, ladder };
  }

  // Binary search between lo (ok) and min(hi, CONCURRENT_MAX_PROBE) (maybe fail)
  let left = lo;
  let right = Math.min(hi, CONCURRENT_MAX_PROBE);
  // If we never failed, right may still be ok at CONCURRENT_MAX_PROBE
  if (ladder.length && ladder[ladder.length - 1].ok && ladder[ladder.length - 1].n >= CONCURRENT_MAX_PROBE) {
    return { maxConcurrent: CONCURRENT_MAX_PROBE, ladder, capped: true };
  }

  let best = lo;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (mid === 0) {
      left = 1;
      continue;
    }
    // Skip if already measured
    let measured = ladder.find((x) => x.n === mid);
    if (!measured) {
      const r = await allConcurrentSucceed(mid);
      measured = { n: mid, ok: r.ok, successCount: r.successCount, elapsedMs: Math.round(r.elapsedMs) };
      ladder.push(measured);
    }
    if (measured.ok) {
      best = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  ladder.sort((a, b) => a.n - b.n);
  return { maxConcurrent: best, ladder, capped: false };
}

function round(n, d = 1) {
  if (n == null || Number.isNaN(n)) return null;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

async function main() {
  console.log('MCP Watchdog ops measurement');
  console.log(`fixture: ${ECHO}`);
  console.log(`reconnect trials: ${RECONNECT_TRIALS}`);
  console.log(`concurrent probe cap: ${CONCURRENT_MAX_PROBE}`);
  console.log('');

  const reconnect = await measureReconnectTrials(RECONNECT_TRIALS);
  console.log('=== Reconnect (interval probe cycle = forceReconnect path) ===');
  console.log(
    JSON.stringify(
      {
        trials: reconnect.trials,
        successes: reconnect.successes,
        failures: reconnect.failures,
        successRate: round(reconnect.successRate, 4),
        successRatePct: `${round(reconnect.successRate * 100, 2)}%`,
        medianReconnectMs: round(reconnect.medianMs, 1),
        meanReconnectMs: round(reconnect.meanMs, 1),
        p95ReconnectMs: round(reconnect.p95Ms, 1),
        minReconnectMs: round(reconnect.minMs, 1),
        maxReconnectMs: round(reconnect.maxMs, 1),
        errors: reconnect.errors,
      },
      null,
      2,
    ),
  );

  console.log('');
  console.log('=== Concurrent monitored servers ===');
  const concurrent = await findMaxConcurrent();
  console.log(
    JSON.stringify(
      {
        maxConcurrentAllHealthy: concurrent.maxConcurrent,
        cappedAtProbeLimit: Boolean(concurrent.capped),
        ladder: concurrent.ladder,
      },
      null,
      2,
    ),
  );

  console.log('');
  console.log('=== Summary (copy-paste) ===');
  console.log(`Median reconnect time: ${round(reconnect.medianMs, 1)} ms`);
  console.log(
    `Estimated reconnect success rate: ${round(reconnect.successRate * 100, 2)}% (${reconnect.successes}/${reconnect.trials})`,
  );
  console.log(
    `Maximum concurrent monitored servers (tested): ${concurrent.maxConcurrent}${concurrent.capped ? ` (capped; all OK up to ${CONCURRENT_MAX_PROBE})` : ''}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
