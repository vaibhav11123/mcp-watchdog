import net from 'node:net';

const METADATA_HOSTS = new Set(['metadata.google.internal', 'metadata.azure.com']);

/** Strip query and fragment for display / API responses. */
export function displayUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return raw.split('?')[0]?.split('#')[0] ?? raw;
  }
}

function isLinkLocalOrMetadataIp(host: string): boolean {
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const parts = host.split('.').map((p) => Number(p));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
    // 169.254.0.0/16 link-local (includes cloud metadata 169.254.169.254)
    return parts[0] === 169 && parts[1] === 254;
  }
  if (ipVersion === 6) {
    const normalized = host.toLowerCase();
    // fe80::/10 link-local
    return (
      normalized === '::' ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    );
  }
  return false;
}

/**
 * Validate a monitor URL for Watchdog Cloud probes.
 * Allows loopback / private / public http(s) (product polls local MCP).
 * Rejects link-local / cloud metadata hosts.
 */
export function assertSafeMonitorUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('invalid url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('only http(s) urls allowed');
  }
  const host = url.hostname.toLowerCase();
  if (METADATA_HOSTS.has(host)) {
    throw new Error('metadata host not allowed');
  }
  if (isLinkLocalOrMetadataIp(host)) {
    throw new Error('link-local / metadata address not allowed');
  }
  return url;
}
