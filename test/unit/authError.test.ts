import { describe, expect, it } from 'vitest';
import { classifyProbeError, isAuthRequiredError } from '../../src/authError';

describe('isAuthRequiredError', () => {
  it('matches 401 / Unauthorized / WWW-Authenticate', () => {
    expect(isAuthRequiredError('HTTP 401')).toBe(true);
    expect(isAuthRequiredError('status code 401')).toBe(true);
    expect(isAuthRequiredError('Unauthorized')).toBe(true);
    expect(isAuthRequiredError('WWW-Authenticate: Bearer')).toBe(true);
    expect(isAuthRequiredError('www-authenticate realm=x')).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isAuthRequiredError('ECONNREFUSED')).toBe(false);
    expect(isAuthRequiredError('timeout after 5000ms')).toBe(false);
    expect(isAuthRequiredError('404 Not Found')).toBe(false);
  });
});

describe('classifyProbeError', () => {
  it('rewrites auth failures to a stable lastError', () => {
    expect(classifyProbeError('Streamable HTTP error: Unauthorized (401)')).toBe(
      'Auth required (HTTP 401)',
    );
  });

  it('rewrites clear AWS session-expired wording', () => {
    expect(
      classifyProbeError('Your session has expired. Please reauthenticate using aws login'),
    ).toBe('AWS credentials expired — run: aws login --profile <profile>');
  });

  it('does not rewrite bare MCP -32602 (not AWS-specific)', () => {
    expect(classifyProbeError('MCP error -32602: Invalid request parameters')).toBe(
      'MCP error -32602: Invalid request parameters',
    );
  });

  it('passes through other messages unchanged', () => {
    expect(classifyProbeError('Max retries exceeded')).toBe('Max retries exceeded');
  });
});
