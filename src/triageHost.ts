/**
 * Extension-host Fix / Remove / credential wizard (vscode-dependent).
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { ServerOrigin } from './config-core';
import type { McpServerConfig } from './config-core';
import {
  buildFixSteps,
  classifyFailure,
  type FixStep,
  type ClassifyFailureInput,
} from './failureTriage';
import { deleteServerKey, mergeServerCredential } from './mcpJsonEdit';
import { awsProfileFromEnv, matchRecipe, type CredSlot } from './vendorRecipes';
import { secretStorageKey } from './credentialOverlay';
import { tryRestartEditorMcp, type EditorMcpHost } from './editorMcp';
import type { ServerStatus } from './monitor';
import type { Logger } from './logger';
import * as telemetry from './telemetry/client';
import type { TriageSurface } from './telemetry/events';
import { notifyValueMoment } from './githubStar';

const ALLOWED_LOGIN_HOSTS = new Set(['mcp.exa.ai', 'dashboard.exa.ai']);

export function resolveServerArg(arg: unknown): string | undefined {
  if (typeof arg === 'string') return arg;
  if (arg && typeof arg === 'object' && 'serverName' in arg) {
    return String((arg as { serverName: string }).serverName);
  }
  return undefined;
}

export async function runFixFailure(deps: {
  serverName: string;
  status: ServerStatus;
  config?: McpServerConfig;
  origin?: ServerOrigin;
  logger: Logger;
  secrets: vscode.SecretStorage;
  surface?: TriageSurface;
  editorHost: EditorMcpHost;
  retryProbe: (name: string) => Promise<void>;
  openConfigPath: (filePath: string) => Promise<void>;
  onWatchdogOnlyCred?: (name: string) => void;
}): Promise<void> {
  const recipe = matchRecipe({ name: deps.serverName, config: deps.config });
  let awsProfile: string | undefined;
  if (deps.config?.type === 'stdio' && deps.config.env) {
    awsProfile = awsProfileFromEnv(deps.config.env);
  }
  const input: ClassifyFailureInput = {
    serverName: deps.serverName,
    lastError: deps.status.lastError,
    lastProbeError: deps.status.lastProbeError,
    failureContext: deps.status.failureContext,
    config: deps.config,
    awsProfileId: awsProfile,
    loginUrl: recipe?.loginUrl,
    wave2Actions: true,
  };
  const cls = classifyFailure(input);
  const steps = buildFixSteps(cls, input);
  deps.logger.info(`[Watchdog] Fix ${deps.serverName}: class=${cls}`);

  const picked = await vscode.window.showQuickPick(
    steps.map((s) => ({
      label: s.label,
      description: s.id,
      step: s,
    })),
    { title: `Fix ${deps.serverName} (${cls})`, placeHolder: 'Choose a remediation step' },
  );
  if (!picked) return;
  telemetry.track('triage_action', {
    action: 'fix_step',
    surface: deps.surface ?? 'quickpick',
    fixStepId: picked.step.id,
    failureClass: cls,
  });
  notifyValueMoment();
  await executeFixStep(picked.step, deps, recipe?.credSlot, recipe?.loginUrl, awsProfile);
}

async function executeFixStep(
  step: FixStep,
  deps: {
    serverName: string;
    status: ServerStatus;
    config?: McpServerConfig;
    origin?: ServerOrigin;
    logger: Logger;
    secrets: vscode.SecretStorage;
    editorHost: EditorMcpHost;
    retryProbe: (name: string) => Promise<void>;
    openConfigPath: (filePath: string) => Promise<void>;
    onWatchdogOnlyCred?: (name: string) => void;
  },
  credSlot?: CredSlot,
  loginUrl?: string,
  awsProfile?: string,
): Promise<void> {
  switch (step.id) {
    case 'copy.command':
      if (step.detail) {
        await vscode.env.clipboard.writeText(step.detail);
        void vscode.window.showInformationMessage('Copied to clipboard.');
      }
      return;
    case 'open.config': {
      const p = deps.origin?.path;
      if (p) await deps.openConfigPath(p);
      else await vscode.commands.executeCommand('mcpWatchdog.openMcpConfig');
      return;
    }
    case 'retry.probe':
      await deps.retryProbe(deps.serverName);
      return;
    case 'restart.editorMcp': {
      const result = await tryRestartEditorMcp(deps.editorHost, deps.serverName);
      if (result.ok) {
        void vscode.window.showInformationMessage(`Editor MCP restart via ${result.method}`);
      } else {
        void vscode.window.showInformationMessage(
          result.detail ?? 'Editor MCP restart unavailable — try Reload Window.',
        );
      }
      return;
    }
    case 'reload.window':
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
      return;
    case 'show.log':
      deps.logger.show();
      return;
    case 'terminal.awsLogin': {
      const profile = awsProfile?.trim() || '<profile>';
      const cmd = `aws login --profile ${profile}`;
      const term = vscode.window.createTerminal({
        name: `MCP Watchdog: aws login (${deps.serverName})`,
      });
      term.show();
      term.sendText(cmd, false);
      void vscode.window.showInformationMessage(
        'Terminal ready — press Enter to run aws login (no secrets are echoed by Watchdog).',
      );
      return;
    }
    case 'openExternal.login': {
      const url = step.detail || loginUrl;
      if (!url || !isAllowlistedLoginUrl(url)) {
        void vscode.window.showWarningMessage('No allowlisted login URL for this server.');
        return;
      }
      await vscode.env.openExternal(vscode.Uri.parse(url));
      return;
    }
    case 'openExternal.prm': {
      await tryOpenPrmAuthorize(deps.config, deps.logger);
      return;
    }
    case 'credential.wizard': {
      await runCredentialWizard(deps, credSlot);
      return;
    }
    default:
      return;
  }
}

function isAllowlistedLoginUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return ALLOWED_LOGIN_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

async function tryOpenPrmAuthorize(
  config: McpServerConfig | undefined,
  logger: Logger,
): Promise<void> {
  if (!config || (config.type !== 'http' && config.type !== 'sse')) {
    void vscode.window.showInformationMessage('PRM discovery needs an HTTP/SSE server URL.');
    return;
  }
  let base: URL;
  try {
    base = new URL(config.url);
  } catch {
    void vscode.window.showWarningMessage('Invalid server URL for PRM discovery.');
    return;
  }
  if (
    base.protocol !== 'https:' &&
    base.hostname !== '127.0.0.1' &&
    base.hostname !== 'localhost'
  ) {
    void vscode.window.showWarningMessage('PRM fetch only over HTTPS (or localhost).');
    return;
  }
  const prmUrl = new URL('/.well-known/oauth-protected-resource', base.origin).toString();
  try {
    const res = await fetch(prmUrl, { method: 'GET' });
    if (!res.ok) {
      void vscode.window.showWarningMessage(`PRM discovery failed (HTTP ${res.status}).`);
      return;
    }
    const json = (await res.json()) as { authorization_endpoint?: string };
    const auth = json.authorization_endpoint;
    if (!auth || !/^https:/i.test(auth)) {
      void vscode.window.showWarningMessage('PRM response missing HTTPS authorization_endpoint.');
      return;
    }
    await vscode.env.openExternal(vscode.Uri.parse(auth));
  } catch (err) {
    logger.info(
      `[Watchdog] PRM discovery failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    void vscode.window.showWarningMessage('PRM discovery failed — see Output log.');
  }
}

async function runCredentialWizard(
  deps: {
    serverName: string;
    config?: McpServerConfig;
    origin?: ServerOrigin;
    logger: Logger;
    secrets: vscode.SecretStorage;
    onWatchdogOnlyCred?: (name: string) => void;
  },
  credSlot?: CredSlot,
): Promise<void> {
  if (!credSlot || credSlot.kind === 'awsProfile') {
    void vscode.window.showInformationMessage(
      'No env/header credential slot for this server. Use Open MCP Config or AWS login instead.',
    );
    return;
  }
  const slotLabel = credSlot.kind === 'env' ? `env ${credSlot.name}` : `header ${credSlot.name}`;
  const value = await vscode.window.showInputBox({
    title: `Credential for ${deps.serverName}`,
    prompt: `Enter value for ${slotLabel} (stored in SecretStorage; never logged)`,
    password: true,
    ignoreFocusOut: true,
  });
  if (value === undefined || value === '') return;

  const key = secretStorageKey(deps.serverName, credSlot.name);
  await deps.secrets.store(key, value);
  deps.logger.info(
    `[Watchdog] Stored credential slot ${credSlot.kind}:${credSlot.name} for ${deps.serverName}`,
  );

  const dual = await vscode.window.showInformationMessage(
    deps.origin?.path
      ? `Also write this into ${deps.origin.path} so Cursor/Claude see it? (may require re-approval if fingerprint changes)`
      : 'Credential stored for Watchdog only. Open MCP Config to add it for the editor.',
    ...(deps.origin?.path ? (['Write to mcp.json', 'Watchdog only'] as const) : (['OK'] as const)),
  );

  if (dual === 'Write to mcp.json' && deps.origin?.path) {
    try {
      const raw = fs.readFileSync(deps.origin.path, 'utf8');
      const result = mergeServerCredential(
        raw,
        deps.serverName,
        { kind: credSlot.kind, name: credSlot.name },
        value,
      );
      if (!result.ok) {
        void vscode.window.showWarningMessage(
          `Could not dual-write (${result.reason}). Opening file — use Disable or edit manually.`,
        );
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(deps.origin.path));
        await vscode.window.showTextDocument(doc);
        deps.onWatchdogOnlyCred?.(deps.serverName);
        return;
      }
      fs.writeFileSync(deps.origin.path, result.raw, 'utf8');
      void vscode.window.showInformationMessage(
        'Wrote credential into MCP config (names only logged).',
      );
    } catch (err) {
      deps.logger.info(
        `[Watchdog] Dual-write failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      void vscode.window.showWarningMessage(
        'Dual-write failed — credential kept in Watchdog SecretStorage.',
      );
      deps.onWatchdogOnlyCred?.(deps.serverName);
    }
  } else {
    deps.onWatchdogOnlyCred?.(deps.serverName);
    void vscode.window.showInformationMessage(
      'Watchdog will use the stored credential on the next probe. Editor may still need the key.',
    );
  }
}

/** Host / CI: skip Remove / Disable confirmation modals when set to `1`. */
export function hostAutoconfirmEnabled(): boolean {
  return process.env.MCP_WATCHDOG_HOST_AUTOCONFIRM === '1';
}

export async function runRemoveServer(deps: {
  serverName: string;
  origin?: ServerOrigin;
  origins: Record<string, ServerOrigin>;
  logger: Logger;
  secrets: vscode.SecretStorage;
  surface?: TriageSurface;
  disableServer: (name: string) => Promise<void>;
  clearAcceptance: (name: string) => Promise<void>;
}): Promise<void> {
  const origin = deps.origin;
  const autoconfirm = hostAutoconfirmEnabled();
  if (!origin?.path) {
    if (autoconfirm) {
      await deps.disableServer(deps.serverName);
      return;
    }
    const pick = await vscode.window.showWarningMessage(
      `No owning config path for ${deps.serverName}. Disable Watchdog monitoring instead?`,
      'Disable',
      'Cancel',
    );
    if (pick === 'Disable') await deps.disableServer(deps.serverName);
    return;
  }

  if (!autoconfirm) {
    const confirm = await vscode.window.showWarningMessage(
      `Remove "${deps.serverName}" from:\n${origin.path}\n(${origin.label})\n\nFully quit Claude Desktop after Desktop-layer edits so MCP reloads.`,
      { modal: true },
      'Remove',
      'Disable instead',
    );
    if (!confirm || confirm === undefined) return;
    if (confirm === 'Disable instead') {
      await deps.disableServer(deps.serverName);
      return;
    }
  }

  let raw: string;
  try {
    raw = fs.readFileSync(origin.path, 'utf8');
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Could not read ${origin.path}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }

  const result = deleteServerKey(raw, deps.serverName);
  if (!result.ok) {
    const open = await vscode.window.showWarningMessage(
      `Cannot safely rewrite ${path.basename(origin.path)} (${result.reason}). Open file and/or Disable?`,
      'Open file',
      'Disable',
      'Cancel',
    );
    if (open === 'Open file') {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(origin.path));
      await vscode.window.showTextDocument(doc);
      try {
        await vscode.commands.executeCommand('workbench.actions.view.problems');
      } catch {
        /* optional */
      }
    } else if (open === 'Disable') {
      await deps.disableServer(deps.serverName);
    }
    return;
  }

  fs.writeFileSync(origin.path, result.raw, 'utf8');
  deps.logger.info(`[Watchdog] Removed ${deps.serverName} from ${origin.path}`);
  telemetry.track('triage_action', {
    action: 'remove',
    surface: deps.surface ?? 'command',
  });
  notifyValueMoment();

  // Best-effort clear secrets
  try {
    const recipe = matchRecipe({ name: deps.serverName });
    if (recipe?.credSlot && recipe.credSlot.kind !== 'awsProfile') {
      await deps.secrets.delete(secretStorageKey(deps.serverName, recipe.credSlot.name));
    }
  } catch {
    /* ignore */
  }
  await deps.clearAcceptance(deps.serverName);

  // Rebound: name still in another layer after merge?
  const stillElsewhere = Object.entries(deps.origins).some(
    ([n, o]) => n === deps.serverName && o.path !== origin.path,
  );
  if (stillElsewhere) {
    void vscode.window.showInformationMessage(
      `Removed from ${origin.label}, but "${deps.serverName}" may still appear from another config layer.`,
    );
  } else {
    void vscode.window.showInformationMessage(`Removed ${deps.serverName} from ${origin.label}.`);
  }
}
