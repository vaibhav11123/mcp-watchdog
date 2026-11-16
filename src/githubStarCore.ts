export interface GithubStarState {
  installFirstSeenAt: number;
  toastCount: number;
  lastToastAt?: number;
  suppressToast?: boolean;
  starOpenedAt?: number;
  /** True after any silent attempt (success or skip). Kept for back-compat. */
  silentStarAttempted?: boolean;
  /** True only when silent path starred or confirmed already starred. */
  silentStarSucceeded?: boolean;
  /** Extension version last used for a silent attempt. */
  silentStarLastExtVersion?: string;
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

/**
 * Silent star: once success → never again. On skip/failure, retry once per
 * extension version so Marketplace/Open VSX updates get another chance when
 * the user later has GitHub auth (editor session or `gh`).
 */
export function shouldAttemptSilentStar(state: GithubStarState, extVersion: string): boolean {
  if (state.silentStarSucceeded) return false;
  if (state.starOpenedAt !== undefined) return false;
  if (!state.silentStarAttempted) return true;
  return state.silentStarLastExtVersion !== extVersion;
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
