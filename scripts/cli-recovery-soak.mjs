#!/usr/bin/env node
/** EXECUTE F2 — repeat Act+Prove journey file N times (cross-platform). */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const times = Number(process.env.CLI_RECOVERY_SOAK_TIMES || 10);

for (let i = 1; i <= times; i++) {
  console.log(`cli-recovery-soak ${i}/${times}`);
  const r = spawnSync(
    process.execPath,
    [
      path.join(root, 'node_modules', 'vitest', 'vitest.mjs'),
      'run',
      'test/unit/cli-actProve-journey.test.ts',
    ],
    { cwd: root, stdio: 'inherit', env: process.env },
  );
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
}
console.log('cli-recovery-soak: OK');
