# LOGIC-MATRIX — Priya live + unit oracle

| id | module | branch | force recipe | oracle | result | evidence |
|---|---|---|---|---|---|---|
| B1-01 | monitor | connecting | Start after trust | UI/log | **blocked** | Trust not completed → no monitor spawn |
| B1-02 | monitor | healthy | Echo up | Status | **blocked** | Same |
| B1-03 | monitor | failed | kill echo | Toast+state | **blocked** | No child to kill |
| B1-04 | monitor | degraded | passive/transient | Label | **blocked** | |
| B1-05 | monitor | disconnected | Disable perServer | Offline | **partial** | Live: Offline rows while untrusted (A7-04) |
| B1-06 | monitor | failed→healthy | Reconnect | Green | **blocked** | |
| B2-01 | alerts | notify none | Unit | No toast | **pass** | unit-logic / alerts.test |
| B2-02 | alerts | notify failures | Live kill | Fail toast | **blocked** | Need healthy→fail live |
| B2-03 | alerts | notify all recover | Unit | Info toast | **pass** | unit |
| B2-04 | alerts | mute | Live | Suppressed | **blocked** | |
| B2-05 | alerts | flap | Unit | flap | **pass** | unit |
| B2-06 | alerts | degraded delay | Unit | warning | **pass** | unit |
| B2-07 | alerts | disabled | perServer off | No alert | **partial** | settings disable aws/exa; live untrusted masks |
| B3-01 | trust | approve | Review & Allow | Monitors | **gap** | Toast+status seen; accept not confirmed; Overview wrong |
| B3-02 | trust | revoke | Empty select | Untrusted | **blocked** | |
| B3-03 | trust | fingerprint secrets | Unit | Pass | **pass** | trust.test |
| B3-04 | trust | partial allowlist | Subset | Only those | **blocked** | |
| B4-01 | config | load mcp.json | EH workspace | Servers listed | **pass** | A7-05 mcp.json + A7-04 tree 6 servers |
| B4-02 | config | lint bad type | Unit | Pass | **pass** | unit |
| B4-03 | config | workspaceFolder | Unit | Pass | **pass** | unit |
| B4-04 | config | Overview empty messaging | Live untrusted+folder open | Untrusted Overview | **fail** | A7-04 Overview “Open a folder” while tree untrusted |
| B5-01 | probe-core | diffTools | test:unit | Pass | **pass** | unit-logic.txt |
| B5-02 | probe-core | bridge scrub | t2 + cloud | reject secrets / optIn | **pass** | unit-logic; cloud 400 without optIn |
| B5-03 | probe-core | HTTP packs t0 | t0 | Pass | **pass** | unit-logic.txt |
| B5-04 | monitor | toolDrift | Live | Note | **blocked** | |
| B6-01 | authError | classify | Unit | Pass | **pass** | unit |
| B6-02 | passiveHttp | advisory | Unit/live | degraded | **pass** unit / **blocked** live | unit |
| B7-01 | incidents | export markdown | Cmd | No secrets | **partial** | A8-10 invoked; no fail incident payload |
| B8-01 | cloud | register+poll | POST+UI | failed state | **pass** | cloud-api.txt; A10-01 |
| B8-02 | cloud | bridge dual-truth | POST optIn schema | Row | **pass** | A10-03; cloud-api.txt |
| B8-03 | cloud | policy npx -y | evaluate | deny | **pass** | cloud-api.txt; A10 audit |
| B8-04 | cloud | policy node | evaluate | allow | **pass** | cloud-api.txt |
| B9-01 | suite | compile+unit+t0+t2 | npm | Green | **pass** | unit-logic.txt |
| B9-02 | suite | test:host | vscode-test | Electron | **fail** env | host-logic.txt ENOENT Electron |
| B0-dup | activate | duplicate installs | EH+marketplace | Single activate | **fail** product | A2-00; renderer Cannot register views |

Coverage: unit/cloud logic gates green; live monitor/alert state machine **blocked** by trust+Overview sync gap; activation duplicate is P0 for EH/dev UX.
