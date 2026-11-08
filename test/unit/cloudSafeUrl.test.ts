import { describe, expect, it } from 'vitest';
import { assertSafeMonitorUrl, displayUrl } from '../../packages/cloud/src/safeUrl';

describe('assertSafeMonitorUrl', () => {
  it('allows localhost MCP URLs', () => {
    expect(assertSafeMonitorUrl('http://127.0.0.1:3921/mcp').href).toContain('127.0.0.1');
  });

  it('rejects metadata / link-local', () => {
    expect(() => assertSafeMonitorUrl('http://169.254.169.254/latest')).toThrow(
      /link-local|metadata/,
    );
    expect(() => assertSafeMonitorUrl('http://metadata.google.internal/')).toThrow(/metadata/);
  });

  it('rejects non-http schemes', () => {
    expect(() => assertSafeMonitorUrl('file:///etc/passwd')).toThrow(/http/);
  });
});

describe('displayUrl', () => {
  it('strips query and hash', () => {
    expect(displayUrl('https://x.example/mcp?token=secret#frag')).not.toContain('secret');
    expect(displayUrl('https://x.example/mcp?token=secret#frag')).not.toContain('frag');
  });
});
