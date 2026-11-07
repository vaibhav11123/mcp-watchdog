export interface FailureTextInput {
  lastError?: string;
  lastProbeError?: string;
  failureContext?: string;
}

/** Prefer lastProbeError, then scrape failureContext (skip max-retries lines), else lastError. */
export function resolveFailureText(input: FailureTextInput): string {
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

export function failureTextImpliesRetryExhausted(input: FailureTextInput): boolean {
  const blob = [input.lastError, input.lastProbeError, input.failureContext]
    .filter(Boolean)
    .join('\n');
  return /Max retries exceeded/i.test(blob);
}
