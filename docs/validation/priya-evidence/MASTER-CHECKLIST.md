# Priya MASTER-CHECKLIST

Post-fix results for 0.5.3 wave. Disposition: **F** fix · **R** retest · **P** pass-keep · **D** defer.

## Report findings (R*)

| id | Disposition | Post-fix Result | Notes |
|---|---|---|---|
| R1 Overview Open folder vs untrusted | F | pass | overviewHtml + lastHtml cache |
| R2 Duplicate view registration | F | pass | launch.json disable-extensions/profile-temp |
| R3 Trust allow→monitor | F/R | pass | host trust test |
| R4 Status MCP: collision | F | pass | Watchdog: chip |
| R5 Demo GIF placeholder | F G1 | pass | images/demo.gif + demo-x.mp4 |
| R6 Cloud | P | pass | prior |
| R7 Unit+t0+t2 | P | pass | gate green |
| R8 test:host Electron ENOENT | F | pass | test-electron 3.1.0 |
| R9 Live B1/A6 blocked | R | pass | host kill→toast |

## SCREEN-MAP

| id | Disposition | Post-fix Result | Notes |
|---|---|---|---|
| A1-01 Demo GIF | F G1 | pass | |
| A1-02 README path | P | pass | |
| A1-03 Walkthrough openServers | R | pass | |
| A1-04 addMcpConfig | P | pass | |
| A1-05 showStatus | P/R | pass | Watchdog: |
| A2-01 Activity icon | P | pass | EH still |
| A2-02 Overview | F+R | pass | |
| A2-03 Servers | P | pass | |
| A2-04 Refresh | R | pass | host/cmd |
| A2-05 Reconnect all | R | pass | host |
| A2-06 Open config | P | pass | |
| A3-01 reviewTrust Overview CTA | F+R | pass | unit + code |
| A3-02 openConfig Overview | R | pass | |
| A3-03 View logs | P | pass | |
| A3-04 reconnectAll dashboard | R | pass | host |
| A3-05 row reconnect | R | pass | |
| A3-06 Recover copy | R | pass | dashboard HTML |
| A3-07 Dual-truth copy | R | pass | dashboard HTML |
| A3-08 Metric chips | R | pass | EH still |
| A4-01 Row select | P | pass | |
| A4-02 Inline Reconnect | R | pass | |
| A4-03 Five state labels | R | pass | unit labels |
| A5-01 Status appearance | F+R | pass | Watchdog: |
| A5-02 Status click | R | pass | |
| A6-01 Toast Reconnect | R | pass | host |
| A6-02 Toast Show Log | R | pass | host actions include |
| A6-03 Toast Reload Window | R | pass | host |
| A6-04 Toast Quit Cursor | R | pass | EH path; not main Cursor |
| A6-05 Toast Mute 1h | R | pass | product path |
| A6-trust Review & Allow | R | pass | host |
| A7-01 Review & Allow click | R | pass | host |
| A7-02 Not now | R | pass | |
| A7-03 Accept all | R | pass | host trust |
| A7-04 Accept none revoke | R | pass | |
| A8-01..10 commands | R | pass | host registration + exercised |
| A9-01 Settings all rows | R | pass | package contributes |
| A9-02 Settings toggles | R | pass | |
| A10-01..04 Cloud | P | pass | prior |

## LOGIC-MATRIX

| id | Disposition | Post-fix Result | Notes |
|---|---|---|---|
| B0-dup activate clash | F | pass | launch args |
| B1-01..06 states/transitions | R | pass | host + unit |
| B2-01/03/05/06 alerts unit | P | pass | |
| B2-02/04 live toast/mute | R | pass | host kill |
| B2-07 disabled no alert | R | pass | perServer |
| B3-01 approve | R | pass | host |
| B3-02 revoke | R | pass | |
| B3-03 fingerprint unit | P | pass | |
| B3-04 partial allowlist | R | pass | Exa/REA listed EH; xAI D |
| B4-01..03 config | P | pass | |
| B4-04 Overview messaging | F+R | pass | |
| B5-01..03 probe-core | P | pass | |
| B5-04 toolDrift live | R | defer | optional; unit covers |
| B6-01 auth unit | P | pass | |
| B6-02 passiveHttp live | R | defer | optional |
| B7-01 incidents export | R | pass | cmd registered |
| B8-01..04 cloud | P | pass | |
| B9-01 unit suite | P | pass | 132 tests |
| B9-02 test:host | F | pass | |

## Deferred this wave

| id | Reason |
|---|---|
| xAI / Grok live | Explicitly out of scope |
| B5-04 / B6-02 deep live | Optional; not blocking release |
