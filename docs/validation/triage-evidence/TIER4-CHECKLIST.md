# Tier 4 — manual Cursor path

**Coach sheet** for maintainer / Priya walkthrough after CU permissions are on.

## Preconditions

- [ ] Accessibility + Screen Recording enabled for Cursor Computer Use (or record manually)
- [ ] F5 **Run Extension (mcp-watchdog-test)**
- [ ] `requireApproval: false`; echo enabled; filesystem-vendored optional
- [ ] No live AWS/Exa credentials in frame

## Steps

1. [ ] Echo healthy → chip shows healthy/total
2. [ ] Kill echo → toast shows Accept / Fix… / Remove / Retry
3. [ ] Accept → chip drops failure; Overview Failed + Accepted
4. [ ] Clear acceptance / recover echo
5. [ ] Optional: enable `filesystem-vendored` → healthy; switch to `filesystem-vendored-fail` → failed → Fix Open config / Remove
6. [ ] Optional Cloud: `cloudBridge.enabled` + local `:8787` → dual-truth after fail/Accept
7. [ ] Mark SCREEN-MAP V-SB/TOAST/TREE/OV stills when captured

## Result

Pending human/CU stills. Logic + host + Cloud stills already green in SCREEN-MAP / WAVE-GATES.
