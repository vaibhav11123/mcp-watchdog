/** Name-only tool fingerprint (sorted names). Dual signal with schema hash. */

export function computeToolsFingerprint(tools: unknown[]): {
  fingerprint: string;
  count: number;
  names: string[];
} {
  const names: string[] = [];
  for (const t of tools) {
    if (t && typeof t === 'object' && 'name' in t) {
      const n = (t as { name: unknown }).name;
      if (typeof n === 'string' && n.length > 0) names.push(n);
    }
  }
  names.sort();
  return { fingerprint: names.join('\0'), count: names.length, names };
}
