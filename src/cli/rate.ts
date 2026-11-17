import { spawn } from 'child_process';
import {
  GITHUB_REPO_URL,
  OPEN_VSX_URL,
  MARKETPLACE_URL,
  resolveOpenStrategy,
  type OpenStrategy,
} from '../reviewAskCore';

const GH_TIMEOUT_MS = 8_000;

function spawnGh(args: string[]): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve) => {
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
    }, GH_TIMEOUT_MS);
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
}

/** Best-effort GitHub star via `gh` CLI (no browser). */
export async function tryCliGithubStar(
  owner = 'vaibhav11123',
  repo = 'mcp-watchdog',
): Promise<'starred' | 'already' | 'skipped'> {
  const path = `user/starred/${owner}/${repo}`;
  try {
    const check = await spawnGh(['api', '-i', path]);
    if (check.stdout.includes('HTTP/1.1 204') || check.stdout.includes('HTTP/2 204')) {
      return 'already';
    }
    const put = await spawnGh(['api', '-X', 'PUT', path]);
    if (put.code === 0) return 'starred';
    return 'skipped';
  } catch {
    return 'skipped';
  }
}

function openUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const platform = process.platform;
    const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
    const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
    const child = spawn(cmd, args, {
      stdio: 'ignore',
      windowsHide: true,
      detached: true,
    });
    child.on('error', () => resolve(false));
    child.unref();
    // Do not wait for browser; treat spawn as success unless error event fires quickly
    setTimeout(() => resolve(true), 50);
  });
}

export type CliRateResult = {
  ok: true;
  command: 'rate';
  githubStar: 'starred' | 'already' | 'skipped' | 'opened_browser';
  store: { kind: OpenStrategy['kind']; url: string; opened: boolean };
  note: string;
  hostConnection: 'unknown';
};

/**
 * CLI Rate: try gh star, else open GitHub repo; then one store URL (default Open VSX ICP).
 */
export async function runCliRate(opts?: { appName?: string }): Promise<CliRateResult> {
  const strategy = resolveOpenStrategy(opts?.appName ?? process.env.TERM_PROGRAM ?? '');
  let githubStar: CliRateResult['githubStar'] = await tryCliGithubStar();
  if (githubStar === 'skipped') {
    const openedGh = await openUrl(GITHUB_REPO_URL);
    githubStar = openedGh ? 'opened_browser' : 'skipped';
  }

  const storeUrl = strategy.kind === 'extension_open' ? strategy.fallbackUrl : strategy.url;
  // CLI cannot extension.open — always open listing URL (Marketplace URL for VS Code hosts)
  const url = strategy.kind === 'extension_open' ? MARKETPLACE_URL : storeUrl || OPEN_VSX_URL;
  const opened = await openUrl(url);

  return {
    ok: true,
    command: 'rate',
    githubStar,
    store: {
      kind: strategy.kind,
      url,
      opened,
    },
    note: 'Does not auto-post Marketplace/Open VSX reviews — opens official UI for you to submit.',
    hostConnection: 'unknown',
  };
}
