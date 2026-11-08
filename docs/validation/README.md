# Validation / release evidence — moved (private)

SIGN-OFF packs, live EH notes, bake-off runs, and related process evidence now live in the **private** ops repo:

**[mcp-watchdog-ops](https://github.com/vaibhav11123/mcp-watchdog-ops)** → `validation/`

```bash
# from product repo root
git submodule update --init docs/ops
# then open: docs/ops/validation/
```

Collaborators need access to the private repo. Public product docs (TESTING, RELEASE, STATUS) stay in this tree and point at ops paths when needed.
