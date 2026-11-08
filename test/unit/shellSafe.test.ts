import { describe, expect, it } from 'vitest';
import { isSafeAwsProfileId } from '../../src/shellSafe';

describe('isSafeAwsProfileId', () => {
  it('accepts normal profile ids', () => {
    expect(isSafeAwsProfileId('default')).toBe(true);
    expect(isSafeAwsProfileId('my-profile_1')).toBe(true);
    expect(isSafeAwsProfileId('org/role')).toBe(false); // slash not in allowlist
    expect(isSafeAwsProfileId('a.b+=,@-c')).toBe(true);
  });

  it('rejects shell metacharacters and empty', () => {
    expect(isSafeAwsProfileId(undefined)).toBe(false);
    expect(isSafeAwsProfileId('')).toBe(false);
    expect(isSafeAwsProfileId("evil'; rm -rf /")).toBe(false);
    expect(isSafeAwsProfileId('a$(id)')).toBe(false);
    expect(isSafeAwsProfileId("a'b")).toBe(false);
  });
});
