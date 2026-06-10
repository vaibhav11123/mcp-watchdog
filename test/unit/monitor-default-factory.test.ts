import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockConnect = vi.fn(async () => {});
  const mockClient = {
    connect: mockConnect,
    ping: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  return {
    mockConnect,
    mockClient,
    StdioClientTransport: vi.fn(),
    StreamableHTTPClientTransport: vi.fn(),
    Client: vi.fn(() => mockClient),
  };
});

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: mocks.Client,
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: mocks.StdioClientTransport,
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: mocks.StreamableHTTPClientTransport,
}));

import { ServerMonitor } from '../../src/monitor';
import type { McpServerConfig } from '../../src/config-core';

const options = {
  probeMode: 'persistent' as const,
  pingIntervalMs: 30_000,
  pingTimeoutMs: 5000,
  maxRetries: 1,
  initialBackoffMs: 1000,
  backoffMultiplier: 1.5,
  maxBackoffMs: 30_000,
  jitterRand: () => 0.5,
};

describe('ServerMonitor default client factory', () => {
  it('builds stdio transport from config', async () => {
    const config: McpServerConfig = {
      type: 'stdio',
      command: 'node',
      args: ['server.js'],
      env: { FOO: 'bar' },
      cwd: '/tmp',
    };
    const monitor = new ServerMonitor('s', config, options, vi.fn(), vi.fn());
    await monitor.start();

    expect(mocks.StdioClientTransport).toHaveBeenCalledWith({
      command: 'node',
      args: ['server.js'],
      env: { FOO: 'bar' },
      cwd: '/tmp',
    });
    expect(mocks.mockConnect).toHaveBeenCalled();
    await monitor.stop();
  });

  it('builds http transport with headers', async () => {
    const config: McpServerConfig = {
      type: 'http',
      url: 'http://localhost:3000/mcp',
      headers: { Authorization: 'secret' },
    };
    const monitor = new ServerMonitor('h', config, options, vi.fn(), vi.fn());
    await monitor.start();

    expect(mocks.StreamableHTTPClientTransport).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        requestInit: { headers: { Authorization: 'secret' } },
      }),
    );
    await monitor.stop();
  });

  it('builds http transport without headers when empty', async () => {
    const config: McpServerConfig = {
      type: 'http',
      url: 'http://localhost:3000/mcp',
    };
    const monitor = new ServerMonitor('h2', config, options, vi.fn(), vi.fn());
    await monitor.start();

    const call = mocks.StreamableHTTPClientTransport.mock.calls.at(-1);
    expect(call?.[1]).not.toHaveProperty('requestInit');
    await monitor.stop();
  });
});
