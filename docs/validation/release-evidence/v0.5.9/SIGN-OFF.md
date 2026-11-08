# Sign-off v0.5.9 (verify beat)

- Date (UTC): TBD (after ≥3-day soak from 0.5.7 G0)
- Commit SHA: TBD
- Recorder: TBD
- Platforms smoked: TBD
- Automated: pending at cut time (`ci:local` + `wait-ci` + secrets)
- Live EH L1–L9: L7 **required** for this cut (Overview `Verified:` after Fix + re-probe); L1 skip OK with unit empty-state
- Secrets pass: pending
- Packaged VSIX / GIF: verify beat per [docs/media/GIF-RECORDING.md](../../media/GIF-RECORDING.md)
- Notes: Announce story = verified recovery + incidents.jsonl honesty; claim stage **Now+** (still no bake-off win). Cadence may have advanced SemVer — GTM story is verify.
- Ship decision: **HOLD** (soak + L7 + GIF)

## Eng prep landed (2026-11-08)

- Live EH L7 test + `setVerifiedOutcomeForTests` host hook in tree.  
- Overview unit asserts `Verified:` meta.  
- GIF script: [docs/media/GIF-RECORDING.md](../../media/GIF-RECORDING.md).  
- Extra Live QA pack (not a substitute for READY): [../v0.5.8-live/LIVE-RESULTS.md](../v0.5.8-live/LIVE-RESULTS.md) — host matrix **15 pass**; Overview stills under `v0.5.8-live/stills/`.
- **Early verify capture (pre-soak):** [EARLY-VERIFY-CAPTURE.md](./EARLY-VERIFY-CAPTURE.md) — live toast **`fix ran but verify=unresolved`** + MOV/GIF under `clips/` (local). Does **not** flip this SIGN-OFF to READY.

## Blockers to READY

1. Complete ≥3-day soak from 0.5.7 Open VSX + G0 (~started 2026-11-07 → earliest announce window ~2026-11-10).  
2. Live EH L7 pass on cut SHA (`npm run test:host`).  
3. Demo GIF / still showing Overview **`Verified:`** meta (early pack proves verify toast; Overview line polish still open).  
4. Instinct Slack verify announce draft ask (Now+) — after soak.  
