# Cause catalog — Doctor logic contract

**Status:** Agent-executable SoT for diagnose / derive / verify cases (2026-11-07).  
**System SoT:** [TECHNICAL-ARCHITECTURE.md](../TECHNICAL-ARCHITECTURE.md) §4–5b.  
**UI SoT:** [SCREEN-SPEC.md](./SCREEN-SPEC.md).  
**Living rule:** Adding or changing a `CauseId`, matcher, or `recommendActions` order updates this file in the **same** change.

## Goal

Lock every Doctor case an agent must get right: example error text → `causeId` → confidence → evidence → ordered action ids → UI state → `verifiedOutcome` after re-probe. Do not re-derive taxonomy from the thesis.

## Out of scope

- New `CauseId` values (extend `types.ts` + this catalog together, later).  
- Cloud / bridge / CLI surfaces.  
- Vendor recipe copy overlays (run **after** class; class stays server-name agnostic).

## Repo anchors

| Role | Path |
|------|------|
| Types | [`packages/probe-core/src/diagnostics/types.ts`](../../packages/probe-core/src/diagnostics/types.ts) |
| Classify | [`packages/probe-core/src/diagnostics/classify.ts`](../../packages/probe-core/src/diagnostics/classify.ts) |
| Recommend | [`packages/probe-core/src/diagnostics/recommend.ts`](../../packages/probe-core/src/diagnostics/recommend.ts) |
| Diagnose + verify | [`packages/probe-core/src/diagnostics/diagnose.ts`](../../packages/probe-core/src/diagnostics/diagnose.ts) |
| Derive UI state | [`packages/probe-core/src/diagnostics/deriveState.ts`](../../packages/probe-core/src/diagnostics/deriveState.ts) |
| Extension shim | [`src/failureTriage.ts`](../../src/failureTriage.ts) |
| Existing tests | [`test/unit/diagnose.test.ts`](../../test/unit/diagnose.test.ts) |
| Phase 4 golden fixtures | [`test/unit/goldenFixtures.test.ts`](../../test/unit/goldenFixtures.test.ts) — same `causeId` across vendor-looking names |

Observation shape: [TECHNICAL-ARCHITECTURE.md §4](../TECHNICAL-ARCHITECTURE.md) — do not restate here.

Action lists below use **wave2Actions: true** (production Fix Quick Pick via `triageHost`). Overview row shows only the **first** action id (see screen spec).

---

## Rows

### C-AUTH-MISSING-01 — posthog “No token provided”

| Field | Value |
|-------|--------|
| **Given** | `lastError`: `No token provided. Please provide a valid token.` · serverName `posthog` · observation may be empty |
| **When** | `diagnose({ serverName, lastError })` |
| **Then** | `causeId=auth.missing` · `confidence=high` · evidence includes truncated error · actions (wave2): `show.log`, `open.config`, `credential.wizard`, `retry.probe` · derived state with discovery/auth failed → `failed` |
| **Verify** | After Fix + re-probe with discovery success + auth ok → `verifiedOutcome=resolved` |
| **Dual-truth** | If `hostConnection=unknown`, `unknowns` includes host unobserved line; state still `failed` from probe |
| **Test** | `diagnose / auth taxonomy` › `posthog and acme “No token provided” → same auth.missing` — **covered** |

### C-AUTH-MISSING-02 — acme same text (server-name agnostic)

| Field | Value |
|-------|--------|
| **Given** | Same error string as C-AUTH-MISSING-01 · serverName `acme` |
| **When** | `diagnose(...)` |
| **Then** | Identical `causeId=auth.missing` (recipe may add docs later; class unchanged) |
| **Test** | Same test as C-AUTH-MISSING-01 — **covered** |

### C-AUTH-REJECTED-01 — HTTP 401

| Field | Value |
|-------|--------|
| **Given** | `lastError`: `Auth required (HTTP 401)` · serverName `remote` |
| **When** | `diagnose(...)` |
| **Then** | `causeId=auth.rejected` · `confidence=high` · actions: `show.log`, `open.config`, `credential.wizard`, `retry.probe` |
| **Test** | `401 / unauthorized → auth.rejected` — **covered** |

### C-AUTH-EXPIRED-01 — session expired

| Field | Value |
|-------|--------|
| **Given** | `lastError`: `Your session has expired` |
| **When** | `diagnose(...)` |
| **Then** | `causeId=auth.expired` · `confidence=high` · legacy shim `aws_session` · actions (wave2, default profile): `terminal.awsLogin`, `copy.command` (login), `copy.command` (region tip), `retry.probe`, `restart.editorMcp` |
| **Test** | `session expired → auth.expired (legacy aws_session)` — **covered** |

### C-AUTH-OAUTH-01 — WWW-Authenticate / PRM

| Field | Value |
|-------|--------|
| **Given** | `lastError`: `WWW-Authenticate: Bearer` (or text containing `protected resource metadata` / `prm` / `oauth`) |
| **When** | `diagnose(...)` |
| **Then** | `causeId=auth.oauth_needed` · `confidence=medium` · actions (wave2, no loginUrl): `show.log`, `open.config`, `openExternal.prm`, `credential.wizard`, `retry.probe` |
| **Test** | Intended: `test/unit/diagnose.test.ts` › `oauth / WWW-Authenticate → auth.oauth_needed` — **untested** |

### C-TRANSPORT-HTTP-01 — network without auth language

| Field | Value |
|-------|--------|
| **Given** | `lastError`: `fetch failed` or `ECONNREFUSED` (no token/auth/401 language) |
| **When** | `diagnose(...)` |
| **Then** | `causeId=transport.http` · `confidence=medium` · actions: `show.log`, `open.config`, `retry.probe` |
| **Test** | Intended: `transport.http from ECONNREFUSED / fetch failed` — **untested** |

### C-SPAWN-ENOENT-01 — missing binary

| Field | Value |
|-------|--------|
| **Given** | `lastError`: `spawn npx ENOENT` · optional `stdioCommand: npx` |
| **When** | `diagnose` / `classifyCauseId` |
| **Then** | `causeId=spawn.enoent` · `confidence=high` · actions: `show.log`, `open.config`, optional `copy.command` (`command -v …`), `retry.probe` |
| **Test** | `ENOENT → spawn.enoent` — **covered** (cause id); recommend order — **untested** (intended: `spawn.enoent recommend includes show.log first`) |

### C-SPAWN-CLOSED-01 — connection closed

| Field | Value |
|-------|--------|
| **Given** | `lastError`: `-32000: Connection closed` |
| **When** | `diagnose(...)` |
| **Then** | `causeId=spawn.closed` · `confidence=medium` · same action family as spawn.enoent |
| **Test** | Intended: `Connection closed → spawn.closed` — **untested** |

### C-GENERIC-01 — residual

| Field | Value |
|-------|--------|
| **Given** | `lastError`: `something obscure happened` (no narrower matcher) |
| **When** | `diagnose(...)` |
| **Then** | `causeId=generic` · `confidence=low` · `unknowns` includes no narrower cause · actions: `retry.probe`, `restart.editorMcp`, `show.log`, `open.config`, `reload.window` |
| **Test** | Intended: `unmatched error → generic + low confidence` — **untested** |

### C-RETRY-PEEL-01 — max retries over auth.missing

| Field | Value |
|-------|--------|
| **Given** | `lastError`: `Max retries exceeded` · `lastProbeError` / context: `No token provided` |
| **When** | `diagnose(...)` |
| **Then** | `causeId=auth.missing` · `retryExhausted=true` · evidence may include `retryExhausted` · **never** sole root cause |
| **Test** | `max retries peels to underlying auth.missing + retryExhausted` — **covered** |

### C-DERIVE-HEALTHY-HOST-UNKNOWN-01

| Field | Value |
|-------|--------|
| **Given** | Observation: transport `connected` or discovery `success`, auth `ok`/`not_required`, `hostConnection=unknown` |
| **When** | `deriveServerState({ observation })` |
| **Then** | UI state `healthy` · host Unknown does **not** force failed · diagnose `unknowns` may still list host unobserved when diagnose called with that observation |
| **Test** | Intended: `test/unit/deriveState.test.ts` › `healthy probe + host unknown → healthy` — **untested** |

### C-DERIVE-FAILED-HOST-UNKNOWN-01

| Field | Value |
|-------|--------|
| **Given** | Observation: discovery `failed` or auth `missing`/`rejected`/`expired`, `hostConnection=unknown` |
| **When** | `deriveServerState({ observation })` |
| **Then** | UI state `failed` · never claim editor session is down |
| **Test** | Intended: `failed probe + host unknown → failed` — **untested** |

### C-DERIVE-CONNECTING-01

| Field | Value |
|-------|--------|
| **Given** | `connecting: true` |
| **When** | `deriveServerState(...)` |
| **Then** | `connecting` |
| **Test** | Intended: `connecting flag → connecting` — **untested** |

### C-VERIFY-RESOLVED-01

| Field | Value |
|-------|--------|
| **Given** | before: discovery failed + auth missing · after: discovery success + transport connected + auth ok |
| **When** | `verifyRecovery({ before, after })` |
| **Then** | `resolved` |
| **Test** | `marks resolved when after discovery succeeds` — **covered** |

### C-VERIFY-UNRESOLVED-01

| Field | Value |
|-------|--------|
| **Given** | before and after both discovery failed + auth missing |
| **When** | `verifyRecovery(...)` |
| **Then** | `unresolved` |
| **Test** | `marks unresolved when still failing` — **covered** |

### C-VERIFY-WORSENED-01

| Field | Value |
|-------|--------|
| **Given** | before: auth `missing` · after: auth `rejected` (and discovery failed) |
| **When** | `verifyRecovery(...)` |
| **Then** | `worsened` |
| **Test** | Intended: `auth missing → rejected after Fix → worsened` — **untested** |

### C-VERIFY-UNKNOWN-01

| Field | Value |
|-------|--------|
| **Given** | after: discovery/transport/auth all `unknown` |
| **When** | `verifyRecovery(...)` |
| **Then** | `unknown` |
| **Test** | Intended: `unobservable after → unknown` — **untested** |

---

## Coverage summary

| Status | Row IDs |
|--------|---------|
| Covered in `diagnose.test.ts` | C-AUTH-MISSING-01/02, C-AUTH-REJECTED-01, C-AUTH-EXPIRED-01, C-SPAWN-ENOENT-01 (id), C-RETRY-PEEL-01, C-VERIFY-RESOLVED-01, C-VERIFY-UNRESOLVED-01 |
| Untested (coding pass) | C-AUTH-OAUTH-01, C-TRANSPORT-HTTP-01, C-SPAWN-CLOSED-01, C-GENERIC-01, C-DERIVE-*, C-VERIFY-WORSENED-01, C-VERIFY-UNKNOWN-01, recommend-order assertions |

## Cause sentence map (for Overview / toast)

Plain-language **one sentence** for UI (screen spec binds these). Never put raw log as the headline.

| causeId | Cause sentence (TO-BE) |
|---------|------------------------|
| `auth.missing` | Missing credential — add the token or API key name in MCP config. |
| `auth.rejected` | Credential rejected — check the token or sign in again. |
| `auth.expired` | Session expired — refresh or run login, then retry the probe. |
| `auth.oauth_needed` | Server wants OAuth / sign-in discovery before tools work. |
| `transport.http` | Network or HTTP transport failed — check URL and connectivity. |
| `spawn.enoent` | Command not found — fix the stdio command path or install the binary. |
| `spawn.closed` | Process closed the connection — check stderr and command/cwd. |
| `generic` | Could not classify the failure — open the log, then MCP config. |
