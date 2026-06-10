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

The `release.yml` workflow expects:

- `VSCE_PAT` — Visual Studio Marketplace publish token
- `OVSX_PAT` — Open VSX publish token

Tag `v*` after `CHANGELOG.md` and `package.json` version are updated.
