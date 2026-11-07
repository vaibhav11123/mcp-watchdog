import { spawn } from 'child_process';
import * as vscode from 'vscode';
import * as telemetry from './telemetry/client';
import type { StarMethod } from './telemetry/events';
import { type GithubStarState, parseOwnerRepo, shouldShowStarToast } from './githubStarCore';

export {
  parseOwnerRepo,
  shouldShowStarToast,
  cooldownMsAfterToast,
  type GithubStarState,
} from './githubStarCore';

export const GITHUB_STAR_STATE_KEY = 'mcpWatchdog.githubStar';

const SILENT_DELAY_MS = 45_000;
const GH_TIMEOUT_MS = 8_000;
const TOAST_DEBOUNCE_MS = 2_000;

let sessionToastShown = false;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let silentTimer: ReturnType<typeof setTimeout> | undefined;
let contextRef: vscode.ExtensionContext | undefined;

export type GhStarResult = 'gh_api' | 'already' | 'unavailable' | 'failed';

function readState(context: vscode.ExtensionContext): GithubStarState {
  const raw = context.globalState.get<Partial<GithubStarState>>(GITHUB_STAR_STATE_KEY);
  const now = Date.now();
  if (!raw || typeof raw.installFirstSeenAt !== 'number') {
    return { installFirstSeenAt: now, toastCount: 0 };
  }
  return {
    installFirstSeenAt: raw.installFirstSeenAt,
    toastCount: typeof raw.toastCount === 'number' ? raw.toastCount : 0,
    lastToastAt: typeof raw.lastToastAt === 'number' ? raw.lastToastAt : undefined,
    suppressToast: raw.suppressToast === true,
    starOpenedAt: typeof raw.starOpenedAt === 'number' ? raw.starOpenedAt : undefined,
    silentStarAttempted: raw.silentStarAttempted === true,
  };
}

async function writeState(context: vscode.ExtensionContext, state: GithubStarState): Promise<void> {
  await context.globalState.update(GITHUB_STAR_STATE_KEY, state);
}

export function repoHttpsUrl(context: vscode.ExtensionContext): string {
  const pkg = context.extension.packageJSON as { repository?: { url?: string } | string };
  const url =
    typeof pkg.repository === 'string'
      ? pkg.repository
      : (pkg.repository?.url ?? 'https://github.com/vaibhav11123/mcp-watchdog');
  const cleaned = url.replace(/^git\+/, '').replace(/\.git$/i, '');
  if (cleaned.startsWith('http')) return cleaned;
  const parsed = parseOwnerRepo(cleaned);
  if (parsed) return `https://github.com/${parsed.owner}/${parsed.repo}`;
  return 'https://github.com/vaibhav11123/mcp-watchdog';
}

function ownerRepo(context: vscode.ExtensionContext): { owner: string; repo: string } {
  return (
    parseOwnerRepo(repoHttpsUrl(context)) ?? {
      owner: 'vaibhav11123',
      repo: 'mcp-watchdog',
    }
  );
}

export type SpawnGh = (
  args: string[],
  timeoutMs: number,
) => Promise<{ code: number | null; stdout: string }>;

const defaultSpawnGh: SpawnGh = (args, timeoutMs) =>
  new Promise((resolve) => {
    const child = spawn('gh', args, {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    let stdout = '';
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      resolve({ code: null, stdout });
    }, timeoutMs);
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ code: null, stdout });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout });
    });
  });

let spawnGhImpl: SpawnGh = defaultSpawnGh;

export function setSpawnGhForTests(fn: SpawnGh | undefined): void {
  spawnGhImpl = fn ?? defaultSpawnGh;
}

export async function starViaGh(
  context: vscode.ExtensionContext,
  spawnGh: SpawnGh = spawnGhImpl,
): Promise<GhStarResult> {
  const { owner, repo } = ownerRepo(context);
  const path = `user/starred/${owner}/${repo}`;
  try {
    const check = await spawnGh(['api', '-i', path], GH_TIMEOUT_MS);
    if (check.stdout.includes('HTTP/1.1 204') || check.stdout.includes('HTTP/2 204')) {
      return 'already';
    }
    const put = await spawnGh(['api', '-X', 'PUT', path], GH_TIMEOUT_MS);
    if (put.code === 0) return 'gh_api';
    return put.code === null ? 'unavailable' : 'failed';
  } catch {
    return 'unavailable';
  }
}

export async function starViaGhOrBrowser(
  context: vscode.ExtensionContext,
  opts?: { silent?: boolean },
): Promise<StarMethod> {
  const result = await starViaGh(context);
  if (result === 'already') {
    return opts?.silent ? 'silent_already' : 'already';
  }
  if (result === 'gh_api') {
    return opts?.silent ? 'silent_gh' : 'gh_api';
  }
  if (opts?.silent) return 'silent_skipped';
  await vscode.env.openExternal(vscode.Uri.parse(repoHttpsUrl(context)));
  return 'browser';
}

export function initGithubStar(context: vscode.ExtensionContext): void {
  contextRef = context;
  const state = readState(context);
  if (!context.globalState.get(GITHUB_STAR_STATE_KEY)) {
    void writeState(context, state);
  }
  scheduleSilentStar(context);
}

export function disposeGithubStar(): void {
  if (toastTimer) clearTimeout(toastTimer);
  if (silentTimer) clearTimeout(silentTimer);
  toastTimer = undefined;
  silentTimer = undefined;
  contextRef = undefined;
  sessionToastShown = false;
}

function scheduleSilentStar(context: vscode.ExtensionContext): void {
  if (context.extensionMode === vscode.ExtensionMode.Test) return;
  const state = readState(context);
  if (state.silentStarAttempted) return;
  if (silentTimer) clearTimeout(silentTimer);
  silentTimer = setTimeout(() => {
    void runSilentStar(context);
  }, SILENT_DELAY_MS);
}

async function runSilentStar(context: vscode.ExtensionContext): Promise<void> {
  if (context.extensionMode === vscode.ExtensionMode.Test) return;
  let state = readState(context);
  if (state.silentStarAttempted) return;
  state = { ...state, silentStarAttempted: true };
  await writeState(context, state);

  const method = await starViaGhOrBrowser(context, { silent: true });
  if (method === 'silent_gh' || method === 'silent_already') {
    state = readState(context);
    state.suppressToast = true;
    state.starOpenedAt = Date.now();
    await writeState(context, state);
  }
  telemetry.track('ui_command', { command: 'starOnGitHub', method });
}

/** Call after trust allow / triage success / recovery to healthy. */
export function notifyValueMoment(): void {
  const context = contextRef;
  if (!context) return;
  if (context.extensionMode === vscode.ExtensionMode.Test) return;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    void maybeShowStarToast(context);
  }, TOAST_DEBOUNCE_MS);
}

async function maybeShowStarToast(context: vscode.ExtensionContext): Promise<void> {
  const debugBypass = process.env.MCP_WATCHDOG_STAR_DEBUG === '1';
  let state = readState(context);
  if (
    !shouldShowStarToast(state, Date.now(), {
      debugBypassAge: debugBypass,
      sessionAlreadyShown: sessionToastShown,
    })
  ) {
    return;
  }

  sessionToastShown = true;
  state = {
    ...state,
    toastCount: state.toastCount + 1,
    lastToastAt: Date.now(),
  };
  await writeState(context, state);

  const pick = await vscode.window.showInformationMessage(
    'Watchdog helped — star the repo on GitHub?',
    'Star on GitHub',
    'Not now',
  );

  if (pick === 'Star on GitHub') {
    await openStar(context);
    return;
  }
  if (pick === 'Not now') {
    state = readState(context);
    state.suppressToast = true;
    await writeState(context, state);
  }
}

export async function openStar(context: vscode.ExtensionContext): Promise<void> {
  const method = await starViaGhOrBrowser(context, { silent: false });
  const state = { ...readState(context), suppressToast: true, starOpenedAt: Date.now() };
  await writeState(context, state);

  if (method === 'gh_api' || method === 'already') {
    void vscode.window.showInformationMessage('Thanks for the star!');
  }
  telemetry.track('ui_command', {
    command: 'starOnGitHub',
    method: method === 'silent_skipped' ? 'browser' : method,
  });
}

export function registerStarCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('mcpWatchdog.starOnGitHub', () => openStar(context));
}
