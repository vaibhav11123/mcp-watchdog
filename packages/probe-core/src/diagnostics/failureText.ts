export interface FailureTextInput {
  lastError?: string;
  lastProbeError?: string;
  failureContext?: string;
}

/** Missing stdio binary — Unix ENOENT / Windows CreateProcess / cmd phrases. */
const MISSING_BINARY_RE =
  /ENOENT|command not found|spawn .+ ENOENT|cannot find the (path|file) specified|is not recognized as (an internal or external command|a command)/i;

function preferredFailureLine(input: FailureTextInput): string {
  if (input.lastProbeError?.trim()) return input.lastProbeError.trim();
  if (input.failureContext) {
    const lines = input.failureContext
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]!;
      if (/Max retries exceeded/i.test(line)) continue;
      const stripped = line.replace(
        /^\[.*?\]\s*(Probe failed|Connection failed|Ping failed):\s*/i,
        '',
      );
      if (stripped.length > 0) return stripped;
    }
  }
  return input.lastError?.trim() ?? '';
}

/**
 * Prefer lastProbeError, then scrape failureContext (skip max-retries lines), else lastError.
 * If that yields Connection closed / bare retries but the blob has missing-binary evidence
 * (Windows stderr captured into failureContext), prefer the missing-binary line.
 */
export function resolveFailureText(input: FailureTextInput): string {
  const preferred = preferredFailureLine(input);
  if (MISSING_BINARY_RE.test(preferred)) return preferred;

  const blob = [input.lastProbeError, input.failureContext, input.lastError]
    .filter(Boolean)
    .join('\n');
  if (
    MISSING_BINARY_RE.test(blob) &&
    (/Connection closed/i.test(preferred) || /Max retries exceeded/i.test(preferred) || !preferred)
  ) {
    const lines = blob
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]!;
      if (!MISSING_BINARY_RE.test(line)) continue;
      return line.replace(/^\[.*?\]\s*stderr:\s*/i, '').trim() || line;
    }
  }
  return preferred;
}

export function failureTextImpliesRetryExhausted(input: FailureTextInput): boolean {
  const blob = [input.lastError, input.lastProbeError, input.failureContext]
    .filter(Boolean)
    .join('\n');
  return /Max retries exceeded/i.test(blob);
}
