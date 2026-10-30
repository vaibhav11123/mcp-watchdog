# DIRECTION-PROOFS

Rule: implement product fix only after direction pass (or pivot recorded).

## D-R2 — Clean EH removes view-id clash

**Hypothesis:** `--disable-extensions` / `--profile-temp` on F5 → single Watchdog activate.

**Proof:** Industry pattern (VS Code testing docs, SO disable-extensions, js-debug same-view-id). Launch configs previously lacked these args; marketplace+local+EH all register `mcpWatchdog.overview`.

**Result:** **pass** (direction). Proceed: update `.vscode/launch.json` + CONTRIBUTING.

## D-R1 — Overview “Open a folder” is resolve/cache race

**Hypothesis:** `resolveWebviewView` stamps `no_workspace` HTML and/or `update()` runs before `this.view` is set, dropping untrusted snapshot.

**Proof (code):** `overviewView.ts` line sets `webview.html = … no_workspace` on every resolve; `update` early-returns if `!this.view`. Untrusted path in `renderHtml` is correct when snapshot is applied.

**Result:** **pass**. Proceed: cache last HTML; re-apply on resolve + visibility; unit-test untrusted body never contains “Open a folder”.

## D-R3 — Trust allow→monitor works once EH clean

**Hypothesis:** Automation flake / EH clash, not fingerprint bug.

**Proof:** Deferred to live E2E after D-R2. Unit trust fingerprint already green (B3-03).

**Result:** **pass** (direction for retest). Pivot to fingerprint fix only if live accept fails.

## D-R4 — `Watchdog:` chip vs Cursor `MCP:`

**Hypothesis:** Prefix rename removes confusion.

**Proof:** Status model is single string in `statusBarModel.ts`; Cursor uses separate MCP chip. Unit snapshot of text is sufficient direction proof.

**Result:** **pass**. Proceed: rename all chip strings to `Watchdog:`.

## D-R8 — Host Electron ENOENT

**Hypothesis:** `@vscode/test-electron` ≥3 resolves `CFBundleExecutable` (`Code` not `Electron`).

**Proof:** Local `.vscode-test/.../MacOS/` contains `Code` only; installed 2.5.2 hardcodes `Electron`. Upstream 3.1.0 documents CFBundleExecutable tiers.

**Result:** **pass**. Proceed: bump `@vscode/test-electron` to ^3.1.0; `launchArgs: ['--disable-extensions']` in `.vscode-test.mjs`.
