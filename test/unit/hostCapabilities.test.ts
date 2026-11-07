import { describe, expect, it, vi } from 'vitest';
import {
  baseHostCapabilities,
  detectHostId,
  resolveHostCapabilities,
} from '../../src/hostCapabilities';
import { EDITOR_MCP_RESTART, type EditorMcpHost } from '../../src/editorMcp';

describe('hostCapabilities', () => {
  it('detects cursor / vscode / windsurf', () => {
    expect(detectHostId({ appName: 'Cursor' })).toBe('cursor');
    expect(detectHostId({ appName: 'Visual Studio Code' })).toBe('vscode');
    expect(detectHostId({ appName: 'Windsurf' })).toBe('windsurf');
    expect(detectHostId({ appName: 'Antigravity' })).toBe('antigravity');
    expect(detectHostId({ appName: 'WeirdIDE' })).toBe('unknown');
  });

  it('Cursor never claims observe connection state', () => {
    const caps = baseHostCapabilities('cursor', '1.0');
    expect(caps.canObserveConnectionState).toBe(false);
    expect(caps.canReadMcpConfig).toBe(true);
  });

  it('sets canRestartServer from editorMcp commands', async () => {
    const host: EditorMcpHost = {
      getCommands: async () => [EDITOR_MCP_RESTART],
      executeCommand: vi.fn(),
    };
    const caps = await resolveHostCapabilities({ appName: 'Cursor' }, host, '0.5');
    expect(caps.hostId).toBe('cursor');
    expect(caps.canRestartServer).toBe(true);
    expect(caps.canObserveConnectionState).toBe(false);
  });
});
