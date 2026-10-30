/**
 * Best-effort restart of the editor’s own MCP servers via workbench.mcp.* commands.
 * vscode-free planning + injectable host for unit tests. Cursor may lack these commands.
 */

export const EDITOR_MCP_RESTART = 'workbench.mcp.restartServer';
export const EDITOR_MCP_START = 'workbench.mcp.startServer';
export const EDITOR_MCP_STOP = 'workbench.mcp.stopServer';
export const EDITOR_MCP_LIST = 'workbench.mcp.listServer';
export const EDITOR_MCP_RESET_TOOLS = 'workbench.mcp.resetCachedTools';

export const RESTART_EDITOR_MCP_ACTION = 'Restart editor MCP';

export type EditorMcpMethod =
  | 'restartServer'
  | 'startServer'
  | 'listServer'
  | 'unavailable';

export interface EditorMcpResult {
  ok: boolean;
  method: EditorMcpMethod;
  detail?: string;
}

export interface EditorMcpHost {
  getCommands(filterInternal?: boolean): Thenable<string[]>;
  executeCommand(command: string, ...rest: unknown[]): Thenable<unknown>;
}

export function editorMcpCommandsAvailable(commands: readonly string[]): boolean {
  const set = new Set(commands);
  return (
    set.has(EDITOR_MCP_RESTART) || set.has(EDITOR_MCP_START) || set.has(EDITOR_MCP_LIST)
  );
}

/** Candidate definition ids to try with workbench.mcp.restartServer (name first). */
export function editorMcpRestartIdCandidates(serverName: string): string[] {
  const out = [serverName];
  // VS Code sometimes uses path-like or prefixed ids; try a few harmless variants.
  out.push(`mcp.${serverName}`);
  out.push(serverName.toLowerCase());
  return [...new Set(out.filter((s) => s.length > 0))];
}

export function failureAlertActionsWithEditorMcp(
  commandsAvailable: boolean,
  base: readonly string[] = [
    'Reconnect',
    'Show Log',
    'Reload Window',
    'Quit Cursor',
    'Mute 1h',
  ],
): string[] {
  if (!commandsAvailable) return [...base];
  const actions = [...base];
  const reloadIdx = actions.indexOf('Reload Window');
  if (reloadIdx >= 0) {
    actions.splice(reloadIdx, 0, RESTART_EDITOR_MCP_ACTION);
  } else {
    actions.push(RESTART_EDITOR_MCP_ACTION);
  }
  return actions;
}

/**
 * Try to restart the editor MCP host for one server (or all via start `*`).
 * Never logs secrets; only command method names.
 */
export async function tryRestartEditorMcp(
  host: EditorMcpHost,
  serverName?: string,
): Promise<EditorMcpResult> {
  let commands: string[];
  try {
    commands = await host.getCommands(true);
  } catch (e) {
    return {
      ok: false,
      method: 'unavailable',
      detail: e instanceof Error ? e.message : 'getCommands failed',
    };
  }
  const set = new Set(commands);

  if (set.has(EDITOR_MCP_RESTART) && serverName) {
    for (const id of editorMcpRestartIdCandidates(serverName)) {
      try {
        await host.executeCommand(EDITOR_MCP_RESTART, id);
        return { ok: true, method: 'restartServer', detail: id };
      } catch {
        // try next candidate
      }
    }
  }

  if (set.has(EDITOR_MCP_START)) {
    try {
      if (set.has(EDITOR_MCP_STOP) && serverName) {
        for (const id of editorMcpRestartIdCandidates(serverName)) {
          try {
            await host.executeCommand(EDITOR_MCP_STOP, id);
            await host.executeCommand(EDITOR_MCP_START, id);
            return { ok: true, method: 'startServer', detail: `stop+start:${id}` };
          } catch {
            // try next
          }
        }
      }
      await host.executeCommand(EDITOR_MCP_START, '*');
      return { ok: true, method: 'startServer', detail: '*' };
    } catch (e) {
      return {
        ok: false,
        method: 'startServer',
        detail: e instanceof Error ? e.message : 'startServer failed',
      };
    }
  }

  if (set.has(EDITOR_MCP_LIST)) {
    try {
      await host.executeCommand(EDITOR_MCP_LIST);
      return {
        ok: false,
        method: 'listServer',
        detail: 'Opened MCP: List Servers — use Restart there',
      };
    } catch (e) {
      return {
        ok: false,
        method: 'listServer',
        detail: e instanceof Error ? e.message : 'listServer failed',
      };
    }
  }

  return {
    ok: false,
    method: 'unavailable',
    detail: 'Editor MCP commands not available — use Reload Window',
  };
}
