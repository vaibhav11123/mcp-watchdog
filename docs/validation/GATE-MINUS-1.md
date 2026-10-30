# Gate −1 results

Direction tests T0–T2.

| Test | Command | Result | Date |
|---|---|---|---|
| T1 schema goldens | `npm run test:unit` (diffTools 22+ cases) | **PASS** | 2026-10-30 |
| T0 live probe | `npm run t0` | **PASS** p95=6ms session=404 false-green=ok | 2026-10-30 |
| T2 bridge dry-run | `npm run t2` | **PASS** scrub reject + dual-truth row | 2026-10-30 |

**Gate −1: GREEN**

Benchmarks: [docs/EXECUTION.md](../EXECUTION.md).
