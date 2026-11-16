## Summary

-

## Test plan

- [ ] `npm run lint`
- [ ] `npm run format:check`
- [ ] `npm run compile`
- [ ] `npm run test:unit` (no network)
- [ ] `npm run test:cli-recovery` (when CLI / Act+Prove touched)

## Act+Prove / dual-truth (do not drop)

- [ ] Verify-after-apply still honest (`verifyRecovery` / no Verified on failed execution)
- [ ] CLI/Editor JSON keeps dual-truth (`hostConnection: unknown` unless harness API wired)
- [ ] No secret env/header **values** in logs, JSON, or mcp.json writes

## Notes

- Do not bump `package.json` version (maintainer cuts releases).
- Never commit env/header **values** or secrets.
- User-visible changes → update `CHANGELOG.md` `[Unreleased]` + README if needed.
