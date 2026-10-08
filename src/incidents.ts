import type { ServerState } from './monitor';

export interface IncidentTransition {
  ts: number;
  server: string;
  from: ServerState;
  to: ServerState;
  lastError?: string;
}

const DEFAULT_CAPACITY = 200;

/**
 * Ring buffer of state transitions for incident Markdown export.
 * vscode-free — extension.ts owns file save / UI.
 */
export class IncidentRingBuffer {
  private readonly items: IncidentTransition[] = [];

  constructor(private readonly capacity = DEFAULT_CAPACITY) {}

  record(transition: IncidentTransition): void {
    this.items.push(transition);
    while (this.items.length > this.capacity) {
      this.items.shift();
    }
  }

  /** Record only when `from` ≠ `to`. */
  recordChange(
    server: string,
    from: ServerState | undefined,
    to: ServerState,
    lastError?: string,
    ts = Date.now(),
  ): void {
    if (from === undefined || from === to) return;
    this.record({
      ts,
      server,
      from,
      to,
      ...(lastError ? { lastError } : {}),
    });
  }

  getAll(): IncidentTransition[] {
    return [...this.items];
  }

  clear(): void {
    this.items.length = 0;
  }

  get size(): number {
    return this.items.length;
  }

  exportToMarkdown(): string {
    const lines: string[] = [
      '# MCP Watchdog incidents',
      '',
      `Exported: ${new Date().toISOString()}`,
      `Transitions: ${this.items.length}`,
      '',
    ];

    if (this.items.length === 0) {
      lines.push('_No state transitions recorded yet._', '');
      return lines.join('\n');
    }

    lines.push('| Time (UTC) | Server | From | To | Error |', '|---|---|---|---|---|');

    for (const t of this.items) {
      const time = new Date(t.ts).toISOString();
      const err = t.lastError ? escapeMdCell(t.lastError) : '';
      lines.push(`| ${time} | ${escapeMdCell(t.server)} | ${t.from} | ${t.to} | ${err} |`);
    }

    lines.push('');
    return lines.join('\n');
  }
}

function escapeMdCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
