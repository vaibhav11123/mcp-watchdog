# Contributing

By participating, you agree to our [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

Outbound license is **MIT** ([LICENSE](./LICENSE)). Contributions are accepted under the same terms and the project **CLA** ([docs/CLA.md](./docs/CLA.md)).

## Private ops docs (optional)

Process / GTM / SIGN-OFF docs live in a **private** submodule. Product code does not depend on them.

```bash
git submodule update --init docs/ops   # needs access to mcp-watchdog-ops
```

Map: [docs/OPS.md](./docs/OPS.md). Full model (if you have ops): `docs/ops/DUAL-REPO.md`.

## Development

```bash
npm install
npm run compile
npm run test:unit
npm run build
```

- `packages/probe-core` — vscode-free probe/diff/bridge scrub
- `packages/cloud` — Watchdog Cloud preview (remote health, schema change alerts, configuration policy checks)
- Unit tests must pass with **no network**
- Never log or commit env/header **values**

## Extension Host / F5

Marketplace, a local install, and Extension Development Host can all register the same view IDs (`mcpWatchdog.overview` / `mcpWatchdog.servers`). That causes **Cannot register multiple views** / activation failure.

Use the launch configs in [`.vscode/launch.json`](./.vscode/launch.json), which pass `--disable-extensions` and `--profile-temp`. Prefer **Run Extension (mcp-watchdog-test workspace)**.

Before F5, uninstall or disable other copies of **MCP Watchdog** (publisher `mcp-watchdog`) from Extensions. Host tests also pass `--disable-extensions` via [`.vscode-test.mjs`](./.vscode-test.mjs).

## Docs map (not on the store README)

- Progress / routing stubs: [docs/STATUS.md](./docs/STATUS.md), [docs/OPS.md](./docs/OPS.md)
- Private ops (submodule): `docs/ops/` — RELEASE, TESTING, GTM-*, STRATEGY-THESIS
- Architecture / bake-off: [docs/TECHNICAL-ARCHITECTURE.md](./docs/TECHNICAL-ARCHITECTURE.md), [docs/BAKE-OFF.md](./docs/BAKE-OFF.md)
- GIF re-record notes: [docs/media/GIF-RECORDING.md](./docs/media/GIF-RECORDING.md)

## Ship checklist (maintainers)

1. Hard gates + SIGN-OFF READY (ops `RELEASE.md` / `TESTING.md`) — do not skip soak for announce cuts.
2. Cut matches release map (do not mix Doctor + verify + win in one blast without re-scoping).
3. Update `images/demo.gif` when the failure→Fix→Verified story changes ([GIF-RECORDING.md](./docs/media/GIF-RECORDING.md)).
4. Bump `package.json` + CHANGELOG (buyer voice; never “No GTM announce” in public notes).
5. README / store description only for user-visible deltas; Open VSX stays primary for Cursor.
6. `npm test` && `npx vsce package` — no `test/`, secrets, or ops process in VSIX.
7. Secrets `VSCE_PAT` / `OVSX_PAT`; tag `v*` → [release.yml](./.github/workflows/release.yml) (Marketplace + Open VSX).
8. G0 on published Cursor (Open VSX). Claim stage must match thesis.

```bash
export VSCE_PAT=... OVSX_PAT=...
./scripts/ship-release.sh
```

## CLA

Sign [docs/CLA.md](./docs/CLA.md) before large external PRs (individual or entity). Maintainer may require CLA assistant on GitHub.
