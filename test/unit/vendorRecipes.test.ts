import { describe, expect, it } from 'vitest';
import { awsProfileFromEnv, matchRecipe } from '../../src/vendorRecipes';
import type { McpServerConfig } from '../../src/config-core';

describe('matchRecipe', () => {
  it('exa http → header x-api-key', () => {
    const config: McpServerConfig = {
      type: 'http',
      url: 'https://mcp.exa.ai/mcp',
    };
    const r = matchRecipe({ name: 'exa-search', config });
    expect(r?.id).toBe('exa');
    expect(r?.credSlot).toEqual({ kind: 'header', name: 'x-api-key' });
  });

  it('stdio exa-mcp-server → EXA_API_KEY env', () => {
    const config: McpServerConfig = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'exa-mcp-server'],
    };
    const r = matchRecipe({ name: 'search', config });
    expect(r?.credSlot).toEqual({ kind: 'env', name: 'EXA_API_KEY' });
  });

  it('aws via mcp-proxy-for-aws args', () => {
    const config: McpServerConfig = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'mcp-proxy-for-aws'],
    };
    const r = matchRecipe({ name: 'cloud', config });
    expect(r?.id).toBe('aws');
    expect(r?.credSlot?.kind).toBe('awsProfile');
  });

  it('echo → undefined', () => {
    const config: McpServerConfig = { type: 'stdio', command: 'echo', args: ['ok'] };
    expect(matchRecipe({ name: 'echo', config })).toBeUndefined();
  });
});

describe('awsProfileFromEnv', () => {
  it('reads first profile from comma list', () => {
    expect(awsProfileFromEnv({ AWS_PROFILE: 'alpha,beta' })).toBe('alpha');
  });
});
