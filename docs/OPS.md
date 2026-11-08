# Private ops

Process, GTM, validation, thesis/architecture working copies, and launch packs live in a **private** repo — not on the public product tree.

| | |
|--|--|
| Private SoT | https://github.com/vaibhav11123/mcp-watchdog-ops |
| Local path | `docs/ops/` (git submodule) |

```bash
git submodule update --init docs/ops
```

## What’s in ops

`gtm/` · `validation/` · `launch/` · `tasks/` · `spikes/` · `design/` · `architecture/` · `media/GIF-RECORDING.md` · GTM-*.md · full `STATUS.md` · `STRATEGY-THESIS.md` · `TECHNICAL-ARCHITECTURE.md` · `BAKE-OFF.md` · `RELEASE.md` · `TESTING.md` · research/historical strategy docs · `AGENT-SKILLS.md`

## What stays public

`README.md` · `CHANGELOG.md` · `LICENSE` · `SECURITY.md` · `CONTRIBUTING.md` · this stub · `docs/CLA.md` · `docs/TECHNICAL.md` (historical) · Marketplace `images/` / `docs/media` state assets · thin stubs under `docs/gtm/` and `docs/validation/`.

Invite collaborators on `mcp-watchdog-ops`. CI does not recurse the private submodule.

**History:** older copies may remain in public git history until a rewrite.
