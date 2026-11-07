# Doctor UI — task checklist

Cite [CAUSE-CATALOG.md](../docs/design/CAUSE-CATALOG.md) (`C-*`) and [SCREEN-SPEC.md](../docs/design/SCREEN-SPEC.md) (`S-*`).  
After code slices: `npm run test:unit` and `npm run compile` / `npm run build` before claiming done.

## Docs (this pass)

- [x] Write cause catalog (`C-*` rows)
- [x] Write screen spec (`S-*` rows + design language + live checklist)
- [x] Point thesis / architecture / agent-skills / CHANGELOG at the specs

## Must — coding

- [x] Unit-cover untested catalog rows: `C-AUTH-OAUTH-01`, `C-TRANSPORT-HTTP-01`, `C-SPAWN-CLOSED-01`, `C-GENERIC-01`, `C-DERIVE-*`, `C-VERIFY-WORSENED-01`, `C-VERIFY-UNKNOWN-01` → `test/unit/diagnose.test.ts` / `deriveState.test.ts` · `npm run test:unit`
- [x] Overview failed row: cause sentence + first action; stop raw-error headline — `S-OVERVIEW-FAILED-01` · `npm run test:unit`
- [x] Failure toast ≤3 actions + mute still works — `S-TOAST-01` (and prefer cause in message `S-TOAST-02`) · `npm run test:unit`
- [x] Remove Overview footer essays — `S-OVERVIEW-FOOTER-01` · `npm run test:unit`
- [x] Rename metric Active → Reconnecting — `S-OVERVIEW-METRIC-01` · `npm run test:unit`
- [x] Status tooltip prefers cause sentence — `S-STATUS-01` · `npm run test:unit`
- [x] Keep Fix Quick Pick full recommend list — `S-FIX-QP-01` (no toast-style cap on QP)

## Should — verify

- [ ] Live Extension Host L1–L9 + `docs/validation/release-evidence/v0.5.7/SIGN-OFF.md` per [docs/TESTING.md](../docs/TESTING.md) before 0.5.7 tag ([docs/RELEASE.md](../docs/RELEASE.md))
- [x] Wire `S-VERIFY-01` verifiedOutcome line on Overview after Fix (Phase 3 jsonl + in-memory)

## Do not

- [ ] ~~Cloud / CLI UI~~
- [ ] ~~Sixth UI state / Doctor wizard webview / sidebar illustrations~~
