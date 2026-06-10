# Contributing

## Development

```bash
npm ci
npm run compile && npm run build
npm run test:unit
npm run smoke
```

Full suite: `npm test` (compile, build, unit, smoke, integration).

Host tests (needs display / xvfb on Linux): `npm run test:host`

## Release secrets

The `release.yml` workflow expects GitHub repo secrets:

| Secret | How to get it |
|--------|----------------|
| `VSCE_PAT` | [Marketplace publisher](https://marketplace.visualstudio.com/manage) → Personal Access Token with **Marketplace (Publish)** scope |
| `OVSX_PAT` | [open-vsx.org](https://open-vsx.org) → log in → Profile → **Access Tokens** → generate |

Add both under **GitHub → repo → Settings → Secrets and variables → Actions**.

Then ship:

```bash
export VSCE_PAT=... OVSX_PAT=...
./scripts/ship-release.sh
```

Or push tag `v0.2.0` to trigger `release.yml`.

Launch copy drafts (forum replies, HN, blog) live in `launch/` locally (gitignored). Post discovery only after Open VSX is live and `images/demo.gif` is recorded — see `launch/GIF-RECORDING.md`.
