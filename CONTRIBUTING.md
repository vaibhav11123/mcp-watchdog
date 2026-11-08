# Contributing

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

## CLA

Sign [docs/CLA.md](./docs/CLA.md) before large external PRs (individual or entity). Maintainer may require CLA assistant on GitHub.
