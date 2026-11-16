#!/usr/bin/env node
/**
 * EXECUTE E1b — scripted Act+Prove harness (temp cwd, dual-truth, no secrets).
 * Usage: npm run build && node scripts/cli-recovery-harness.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'mcp-watchdog.mjs');
const flaky = path.join(root, 'mcp-watchdog-test', 'fixtures', 'flaky-once-server.js');

function run(cwd, args) {
  const r = spawnSync(process.execPath, [bin, ...args, '--cwd', cwd], {
    encoding: 'utf8',
    env: { ...process.env, MCP_WATCHDOG_FIX: '1' },
  });
  return {
    code: r.status ?? 1,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-harness-'));
const counter = path.join(dir, 'counter');
try {
  fs.writeFileSync(
    path.join(dir, '.mcp.json'),
    JSON.stringify(
      {
        mcpServers: {
          flaky: {
            command: 'node',
            args: [flaky],
            env: { MCP_WATCHDOG_FLAKY_COUNTER: counter },
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  const doctor = run(dir, ['doctor']);
  assert(doctor.code === 0 || doctor.code === 1, `doctor exit ${doctor.code}`);
  const doctorJson = JSON.parse(doctor.stdout.trim().split('\n').pop());
  assert(doctorJson.hostConnection === 'unknown', 'doctor dual-truth hostConnection');
  assert(doctorJson.dualTruth?.host === 'unknown', 'doctor dualTruth.host');

  const plan = run(dir, ['fix']);
  assert(plan.code === 2 || plan.code === 0 || plan.code === 1, `fix plan exit ${plan.code}`);
  const planJson = JSON.parse(plan.stdout.trim().split('\n').pop());
  assert(planJson.hostConnection === 'unknown', 'fix plan dual-truth');

  if (planJson.plan?.length) {
    const apply = run(dir, ['fix', '--yes']);
    assert(apply.code === 0 || apply.code === 1, `fix --yes exit ${apply.code}`);
    const applyJson = JSON.parse(apply.stdout.trim().split('\n').pop());
    assert(applyJson.hostConnection === 'unknown', 'fix --yes dual-truth');
    assert(!JSON.stringify(applyJson).includes('sk-'), 'no secret-looking tokens in output');
  }

  console.log('cli-recovery-harness: OK');
  process.exit(0);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
