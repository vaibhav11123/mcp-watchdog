import { describe, expect, it, vi } from 'vitest';
import {
  EDITOR_MCP_LIST,
  EDITOR_MCP_RESTART,
  EDITOR_MCP_START,
  EDITOR_MCP_STOP,
  RESTART_EDITOR_MCP_ACTION,
  editorMcpCommandsAvailable,
  editorMcpRestartIdCandidates,
  failureAlertActionsWithEditorMcp,
  tryRestartEditorMcp,
  type EditorMcpHost,
} from '../../src/editorMcp';

function host(commands: string[], execute?: EditorMcpHost['executeCommand']): EditorMcpHost {
  return {
    getCommands: async () => commands,
    executeCommand: execute ?? (async () => undefined),
  };
}

describe('editorMcp', () => {
  it('detects available workbench.mcp commands', () => {
    expect(editorMcpCommandsAvailable([])).toBe(false);
    expect(editorMcpCommandsAvailable([EDITOR_MCP_LIST])).toBe(true);
    expect(editorMcpCommandsAvailable([EDITOR_MCP_RESTART])).toBe(true);
  });

  it('toast-sized base stays ≤3 without Restart (S-TOAST-01)', () => {
    const actions = failureAlertActionsWithEditorMcp(true);
    expect(actions).toEqual(['Fix…', 'Show Log', 'Mute 1h']);
    expect(actions).not.toContain(RESTART_EDITOR_MCP_ACTION);
  });

  it('inserts Restart editor MCP before Reload Window on long lists', () => {
    const long = [
      'Accept',
      'Fix…',
      'Remove',
      'Retry probe',
      'Show Log',
      'Reload Window',
      'Mute 1h',
    ];
    const actions = failureAlertActionsWithEditorMcp(true, long);
    expect(actions).toContain(RESTART_EDITOR_MCP_ACTION);
    expect(actions.indexOf(RESTART_EDITOR_MCP_ACTION)).toBeLessThan(
      actions.indexOf('Reload Window'),
    );
    expect(failureAlertActionsWithEditorMcp(false, long)).not.toContain(RESTART_EDITOR_MCP_ACTION);
  });

  it('restart id candidates include the server name', () => {
    expect(editorMcpRestartIdCandidates('echo')).toContain('echo');
  });

  it('tries restartServer with name first', async () => {
    const execute = vi.fn(async (cmd: string, id?: unknown) => {
      if (cmd === EDITOR_MCP_RESTART && id === 'echo') return;
      throw new Error('bad id');
    });
    const r = await tryRestartEditorMcp(host([EDITOR_MCP_RESTART], execute), 'echo');
    expect(r.ok).toBe(true);
    expect(r.method).toBe('restartServer');
    expect(execute).toHaveBeenCalledWith(EDITOR_MCP_RESTART, 'echo');
  });

  it('falls back to startServer *', async () => {
    const execute = vi.fn(async (cmd: string, id?: unknown) => {
      if (cmd === EDITOR_MCP_START && id === '*') return;
      throw new Error('no');
    });
    const r = await tryRestartEditorMcp(host([EDITOR_MCP_START], execute), 'echo');
    expect(r.ok).toBe(true);
    expect(r.method).toBe('startServer');
    expect(r.detail).toBe('*');
  });

  it('opens listServer when only list is available', async () => {
    const execute = vi.fn(async () => undefined);
    const r = await tryRestartEditorMcp(host([EDITOR_MCP_LIST], execute), 'echo');
    expect(r.ok).toBe(false);
    expect(r.method).toBe('listServer');
    expect(execute).toHaveBeenCalledWith(EDITOR_MCP_LIST);
  });

  it('returns unavailable when no MCP commands', async () => {
    const r = await tryRestartEditorMcp(host([]), 'echo');
    expect(r.ok).toBe(false);
    expect(r.method).toBe('unavailable');
  });

  it('stop+start when both exist and restart missing', async () => {
    const execute = vi.fn(async (cmd: string, id?: unknown) => {
      if ((cmd === EDITOR_MCP_STOP || cmd === EDITOR_MCP_START) && id === 'echo') return;
      throw new Error('no');
    });
    const r = await tryRestartEditorMcp(host([EDITOR_MCP_STOP, EDITOR_MCP_START], execute), 'echo');
    expect(r.ok).toBe(true);
    expect(r.method).toBe('startServer');
    expect(r.detail).toMatch(/stop\+start:echo/);
  });
});
