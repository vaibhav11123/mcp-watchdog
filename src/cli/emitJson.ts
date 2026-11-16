import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_BUDGET = 8 * 1024;

/** Compact JSON to stdout; spill large payloads and print a pointer (TECH §3). */
export function emitJson(
  value: unknown,
  opts: { pretty?: boolean; cwd?: string; budgetBytes?: number } = {},
): void {
  const pretty = opts.pretty === true;
  let text = pretty ? `${JSON.stringify(value, null, 2)}\n` : `${JSON.stringify(value)}\n`;
  const budget = opts.budgetBytes ?? DEFAULT_BUDGET;
  if (!pretty && Buffer.byteLength(text, 'utf8') > budget) {
    const dir = path.join(opts.cwd ?? process.cwd(), '.mcp-watchdog');
    fs.mkdirSync(dir, { recursive: true });
    const spillPath = path.join(dir, 'last-run.json');
    fs.writeFileSync(spillPath, pretty ? text : `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    text = `${JSON.stringify({
      ok: (value as { ok?: boolean })?.ok ?? false,
      spilled: true,
      path: spillPath,
      note: 'Payload exceeded token budget; full JSON written to path',
    })}\n`;
  }
  process.stdout.write(text);
}
