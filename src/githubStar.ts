import { spawn } from 'child_process';
import * as vscode from 'vscode';
import * as telemetry from './telemetry/client';
import type { StarMethod } from './telemetry/events';
import { type GithubStarState, parseOwnerRepo, shouldAttemptSilentStar } from './githubStarCore';

export {
  parseOwnerRepo,
  shouldShowStarToast,
  shouldAttemptSilentStar,
  cooldownMsAfterToast,
  type GithubStarState,
} from './githubStarCore';

export const GITHUB_STAR_STATE_KEY = 'mcpWatchdog.githubStar';

const SILENT_DELAY_MS = 45_000;
const GH_TIMEOUT_MS = 8_000;
const GITHUB_AUTH_PROVIDER = 'github';
/** Enough to PUT /user/starred on a public repo; automatic path never prompts. */
const GITHUB_STAR_SCOPES = ['public_repo'];

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
    silentStarSucceeded: raw.silentStarSucceeded === true,
    silentStarLastExtVersion:
      typeof raw.silentStarLastExtVersion === 'string' ? raw.silentStarLastExtVersion : undefined,
  };
}

async function writeState(context: vscode.ExtensionContext, state: GithubStarState): Promise<void> {
  await context.globalState.update(GITHUB_STAR_STATE_KEY, state);
}

function extensionVersion(context: vscode.ExtensionContext): string {
  const ver = (context.extension.packageJSON as { version?: string }).version;
  return typeof ver === 'string' && ver.length > 0 ? ver : '0.0.0';
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

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{ status: number }>;

const defaultFetch: FetchLike = async (url, init) => {
  const res = await fetch(url, init);
  return { status: res.status };
};

let fetchImpl: FetchLike = defaultFetch;

export function setFetchForTests(fn: FetchLike | undefined): void {
  fetchImpl = fn ?? defaultFetch;
}

export type GetGithubSession = (opts: {
  silent: boolean;
}) => Promise<{ accessToken: string } | undefined>;

const defaultGetGithubSession: GetGithubSession = async (opts) => {
  try {
    const session = await vscode.authentication.getSession(
      GITHUB_AUTH_PROVIDER,
      GITHUB_STAR_SCOPES,
      opts.silent ? { createIfNone: false, silent: true } : { createIfNone: true },
    );
    return session?.accessToken ? { accessToken: session.accessToken } : undefined;
  } catch {
    return undefined;
  }
};

let getGithubSessionImpl: GetGithubSession = defaultGetGithubSession;

export function setGetGithubSessionForTests(fn: GetGithubSession | undefined): void {
  getGithubSessionImpl = fn ?? defaultGetGithubSession;
}

async function starViaToken(
  context: vscode.ExtensionContext,
  token: string,
): Promise<GhStarResult> {
  const { owner, repo } = ownerRepo(context);
  const path = `https://api.github.com/user/starred/${owner}/${repo}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'mcp-watchdog',
  };
  try {
    const check = await fetchImpl(path, { method: 'GET', headers });
    if (check.status === 204) return 'already';
    const put = await fetchImpl(path, {
      method: 'PUT',
      headers: { ...headers, 'Content-Length': '0' },
    });
    if (put.status === 204 || put.status === 200) return 'gh_api';
    return put.status === 401 || put.status === 403 ? 'unavailable' : 'failed';
  } catch {
    return 'unavailable';
  }
}

/**
 * Use an existing editor GitHub session when present.
 * Silent: never prompts. Explicit (command): may prompt once for public_repo.
 */
export async function starViaVscodeAuth(
  context: vscode.ExtensionContext,
  opts?: { silent?: boolean },
): Promise<GhStarResult> {
  const session = await getGithubSessionImpl({ silent: opts?.silent === true });
  if (!session?.accessToken) return 'unavailable';
  return starViaToken(context, session.accessToken);
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

function mapStarResult(
  result: GhStarResult,
  opts: { silent?: boolean; via: 'vscode' | 'gh' },
): StarMethod | undefined {
  if (result === 'already') {
    return opts.silent ? 'silent_already' : 'already';
  }
  if (result === 'gh_api') {
    if (opts.via === 'vscode') {
      return opts.silent ? 'silent_vscode' : 'vscode_auth';
    }
    return opts.silent ? 'silent_gh' : 'gh_api';
  }
  return undefined;
}

export async function starViaGhOrBrowser(
  context: vscode.ExtensionContext,
  opts?: { silent?: boolean },
): Promise<StarMethod> {
  const vscodeResult = await starViaVscodeAuth(context, opts);
  const fromVscode = mapStarResult(vscodeResult, { silent: opts?.silent, via: 'vscode' });
  if (fromVscode) return fromVscode;

  const ghResult = await starViaGh(context);
  const fromGh = mapStarResult(ghResult, { silent: opts?.silent, via: 'gh' });
  if (fromGh) return fromGh;

  // Automatic / value-moment path: never open a browser or show UI.
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
  if (silentTimer) clearTimeout(silentTimer);
  silentTimer = undefined;
  contextRef = undefined;
}

function scheduleSilentStar(context: vscode.ExtensionContext): void {
  if (context.extensionMode === vscode.ExtensionMode.Test) return;
  const state = readState(context);
  if (!shouldAttemptSilentStar(state, extensionVersion(context))) return;
  if (silentTimer) clearTimeout(silentTimer);
  silentTimer = setTimeout(() => {
    void runSilentStar(context);
  }, SILENT_DELAY_MS);
}

async function runSilentStar(context: vscode.ExtensionContext): Promise<void> {
  if (context.extensionMode === vscode.ExtensionMode.Test) return;
  const ver = extensionVersion(context);
  let state = readState(context);
  if (!shouldAttemptSilentStar(state, ver)) return;

  // Mark attempt for this version before the network call so a crash mid-flight
  // does not hammer GitHub every activate.
  state = {
    ...state,
    silentStarAttempted: true,
    silentStarLastExtVersion: ver,
  };
  await writeState(context, state);

  const method = await starViaGhOrBrowser(context, { silent: true });
  if (method === 'silent_gh' || method === 'silent_vscode' || method === 'silent_already') {
    state = readState(context);
    state.suppressToast = true;
    state.silentStarSucceeded = true;
    state.starOpenedAt = Date.now();
    await writeState(context, state);
  }
  telemetry.track('ui_command', { command: 'starOnGitHub', method });
}

/**
 * Value moment (trust / Fix / recovery): never toast — only another silent star
 * attempt when the current version is still eligible.
 */
export function notifyValueMoment(): void {
  const context = contextRef;
  if (!context) return;
  if (context.extensionMode === vscode.ExtensionMode.Test) return;
  void runSilentStar(context);
}

/**
 * Explicit command only. Prefers auth/gh; browser fallback only when the user
 * invoked Star on GitHub themselves.
 */
export async function openStar(context: vscode.ExtensionContext): Promise<void> {
  // Prefer existing credentials with no prompt first.
  let method = await starViaGhOrBrowser(context, { silent: true });
  if (method === 'silent_skipped') {
    method = await starViaGhOrBrowser(context, { silent: false });
  } else if (method === 'silent_gh') {
    method = 'gh_api';
  } else if (method === 'silent_vscode') {
    method = 'vscode_auth';
  } else if (method === 'silent_already') {
    method = 'already';
  }

  const state = { ...readState(context), suppressToast: true, starOpenedAt: Date.now() };
  if (method === 'gh_api' || method === 'vscode_auth' || method === 'already') {
    state.silentStarSucceeded = true;
  }
  await writeState(context, state);

  if (method === 'gh_api' || method === 'vscode_auth' || method === 'already') {
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
