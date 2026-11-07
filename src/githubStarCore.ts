export interface GithubStarState {
  installFirstSeenAt: number;
  toastCount: number;
  lastToastAt?: number;
  suppressToast?: boolean;
  starOpenedAt?: number;
  silentStarAttempted?: boolean;
}

export const MAX_TOASTS = 3;
export const INSTALL_AGE_MS = 24 * 60 * 60 * 1000;

export function parseOwnerRepo(repositoryUrl: string): { owner: string; repo: string } | undefined {
  const raw = repositoryUrl.trim().replace(/\.git$/i, '');
  const m =
    raw.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\/)?$/i) ?? raw.match(/^([^/]+)\/([^/]+)$/);
  if (!m) return undefined;
  return { owner: m[1]!, repo: m[2]! };
}

export function cooldownMsAfterToast(toastCountAfterIncrement: number): number {
  if (toastCountAfterIncrement <= 1) return 7 * 24 * 60 * 60 * 1000;
  return 14 * 24 * 60 * 60 * 1000;
}

export function shouldShowStarToast(
  state: GithubStarState,
  now: number,
  opts?: { debugBypassAge?: boolean; sessionAlreadyShown?: boolean },
): boolean {
  if (state.suppressToast) return false;
  if (state.toastCount >= MAX_TOASTS) return false;
  if (opts?.sessionAlreadyShown) return false;
  const ageOk = opts?.debugBypassAge === true || now - state.installFirstSeenAt >= INSTALL_AGE_MS;
  if (!ageOk) return false;
  if (state.lastToastAt !== undefined) {
    const need = cooldownMsAfterToast(state.toastCount);
    if (now - state.lastToastAt < need) return false;
  }
  return true;
}
