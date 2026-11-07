# Heavy-user interview brief (Instinct)

**Owner:** Instinct (outreach + notes). Eng supplies product truth only.  
**Claim stage while interviewing:** **Now+** — do not promise bake-off win, diagnose%, or auto-heal.  
**No spend** unless Vaibhav already authorized a specific item.

## Who to talk to

Cursor / VS Code operators who run **≥3 MCP servers**, hit auth or reconnect failures, or care whether the editor “Connected” chip matches reality.

## Five questions

1. Last time an MCP server failed in your editor — how did you notice, and what did you try first?  
2. Would an independent health chip (Watchdog’s own connection) change what you trust vs the editor session?  
3. When something fails, do you want a **short cause sentence** + Fix…, or raw logs first?  
4. After you “fix” something, how do you know it actually recovered?  
5. Would you install a small CLI that doctors Claude Code / Pi / Codex MCP configs the same way? (Phase 6 signal — not a commitment.)

## What we can say today

- Independent probe; cause-first Doctor UI in 0.5.7; toast ≤3; Editor session may stay Unknown.  
- Verified recovery line exists in tree (announce after soak).  
- Eng bake-off 35/36 is **not** a public marketing claim until 0.6.0 + Vaibhav A.

## What we must not say

Bake-off win, diagnose%/resolve% numbers, “best at recovery,” host healthy when Unknown, spend asks via eng.
