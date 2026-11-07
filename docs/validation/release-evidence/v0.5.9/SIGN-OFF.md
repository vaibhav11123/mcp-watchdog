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
- GIF script: [docs/media/GIF-RECORDING.md](../../media/GIF-RECORDING.md) — capture still pending human EH session after soak (not blocking unit/host prep).

## Blockers to READY

1. Complete ≥3-day soak from 0.5.7 Open VSX + G0 (~started 2026-11-07 → earliest announce window ~2026-11-10).  
2. Live EH L7 pass on cut SHA (`npm run test:host`).  
3. Demo GIF includes Verified beat (or document n/a with reason).  
4. Instinct Slack verify announce draft ask (Now+).  
