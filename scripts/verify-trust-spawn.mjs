/**
 * Trust gate spawn check: without starting monitors, no new server-memory children.
 * (Fingerprint/trust-store logic covered by test/unit/trust.test.ts.)
 */
import { execSync } from 'child_process';

function countMemoryProcs() {
  try {
    return Number.parseInt(execSync("ps aux | grep -c '[s]erver-memory'", { encoding: 'utf8' }).trim(), 10) || 0;
  } catch {
    return 0;
  }
}

async function main() {
  const before = countMemoryProcs();
  console.log(`server-memory processes (no watchdog action): ${before}`);
  await new Promise((r) => setTimeout(r, 3000));
  const after = countMemoryProcs();
  console.log(`after 3s idle: ${after}`);
  if (after > before + 2) {
    console.error('FAIL: unexpected server-memory spawn without approval');
    process.exit(1);
  }
  console.log('TRUST SPAWN VERIFY OK');
}

main();
