# Security

## Supported versions

We address security issues in the **latest minor release** on `main` (currently **0.1.x**). Older versions may not receive backports unless noted in a GitHub Security Advisory.

## Reporting a vulnerability

Please **do not** open a public issue for undisclosed security problems.

1. Open a **[private security advisory](https://github.com/vaibhav11123/mcp-watchdog/security/advisories/new)** on this repository (GitHub → **Security** → **Report a vulnerability**), or  
2. Email the maintainer with a clear description, reproduction steps, and impact.

We aim to acknowledge reports within a few business days. Thank you for helping keep users safe.

## Scope

This extension runs **user-defined** commands and connects to **user-configured** MCP endpoints (`stdio` / HTTP). Review `.vscode/mcp.json` in shared repos before trusting it.
