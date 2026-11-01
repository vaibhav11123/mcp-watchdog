/**
 * Secret-safe redaction for stderr / failureContext lines.
 * Never used to display env/header values — only to scrub accidental leaks in process output.
 */

const PATTERNS: RegExp[] = [
  /Bearer\s+\S+/gi,
  /(api[_-]?key|token|secret|password|authorization)\s*[:=]\s*\S+/gi,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
];

export function redactSecrets(line: string): string {
  let out = line;
  for (const re of PATTERNS) {
    out = out.replace(re, '[redacted]');
  }
  return out;
}

/** Cap and redact a stderr/log tail for failureContext. */
export function redactLogTail(lines: string[], maxLines = 40, maxChars = 8192): string {
  const sliced = lines.slice(-maxLines).map(redactSecrets);
  let joined = sliced.join('\n');
  if (joined.length > maxChars) {
    joined = joined.slice(joined.length - maxChars);
  }
  return joined;
}
