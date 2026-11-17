/**
 * Pure Rate / review-ask logic (no vscode).
 * Stickiness-first: one earned ask; GitHub star + one store hop; never forge store reviews.
 */

export const EXTENSION_ID = 'mcp-watchdog.mcp-watchdog';
export const OPEN_VSX_URL = 'https://open-vsx.org/extension/mcp-watchdog/mcp-watchdog';
export const MARKETPLACE_URL =
  'https://marketplace.visualstudio.com/items?itemName=mcp-watchdog.mcp-watchdog';
export const GITHUB_REPO_URL = 'https://github.com/vaibhav11123/mcp-watchdog';
export const FEEDBACK_ISSUES_URL =
  'https://github.com/vaibhav11123/mcp-watchdog/issues/new?title=Feedback';
export const REVIEW_ASK_DELAY_MS = 2000;
export const FIX_DEFER_TIMEOUT_MS = 60_000;

export type StoreSurface = 'openvsx' | 'marketplace';

export type OpenStrategy =
  | {
      kind: 'extension_open';
      extensionId: typeof EXTENSION_ID;
      fallbackUrl: string;
      rateLabel: string;
    }
  | { kind: 'open_external'; url: string; rateLabel: string };

export type ReviewAskGateInput = {
  threshold: number;
  askedReview: boolean;
  recoveryCount: number;
  askInFlight: boolean;
};

export type ReviewAskGateResult =
  | { action: 'noop' }
  | { action: 'count_only'; nextCount: number }
  | { action: 'offer'; nextCount: number };

export type ReviewAskChoice = 'rate' | 'dismiss' | 'feedback';

/** Microsoft VS Code → Marketplace in-IDE; Cursor/forks → Open VSX (ICP). */
export function resolvePrimaryStore(appName: string): StoreSurface {
  const n = (appName || '').toLowerCase();
  if (
    n.includes('cursor') ||
    n.includes('windsurf') ||
    n.includes('codium') ||
    n.includes('trae') ||
    n.includes('antigravity')
  ) {
    return 'openvsx';
  }
  if (n.includes('visual studio code')) return 'marketplace';
  return 'openvsx';
}

export function resolveOpenStrategy(appName: string): OpenStrategy {
  const store = resolvePrimaryStore(appName);
  if (store === 'marketplace') {
    return {
      kind: 'extension_open',
      extensionId: EXTENSION_ID,
      fallbackUrl: MARKETPLACE_URL,
      rateLabel: 'Rate on Marketplace',
    };
  }
  return {
    kind: 'open_external',
    url: OPEN_VSX_URL,
    rateLabel: 'Rate on Open VSX',
  };
}

export function storeListingUrl(surface: StoreSurface): string {
  return surface === 'marketplace' ? MARKETPLACE_URL : OPEN_VSX_URL;
}

export function shouldOfferAsk(input: ReviewAskGateInput): ReviewAskGateResult {
  if (input.threshold <= 0) return { action: 'noop' };
  if (input.askedReview) return { action: 'noop' };
  if (input.askInFlight) return { action: 'noop' };
  const nextCount = input.recoveryCount + 1;
  if (nextCount < input.threshold) {
    return { action: 'count_only', nextCount };
  }
  return { action: 'offer', nextCount };
}

export const RATE_MESSAGE =
  'Glad Watchdog helped recover a server. If it’s useful, a quick rating helps others find it — only if you want to.';

export const RATE_PROMPT_DISABLED =
  'Enable mcpWatchdog.enableReviewAskPreview to try the review ask.';

/** Asked before any GitHub star write from Rate. */
export const GITHUB_STAR_CONFIRM_MESSAGE =
  'Star vaibhav11123/mcp-watchdog on GitHub? This uses your existing GitHub login. It does not post a review.';

export const GITHUB_STAR_CONFIRM_ACCEPT = 'Star';
export const GITHUB_STAR_CONFIRM_DECLINE = 'Not now';

/** Explicit yes only. Empty, Not now, and any other answer are a decline. */
export function isExplicitStarConfirm(answer: string | undefined | null): boolean {
  if (typeof answer !== 'string') return false;
  const normalized = answer.trim().toLowerCase();
  return normalized === 'y' || normalized === 'yes' || normalized === 'star';
}

/**
 * Runs `write` only when `confirmed` is exactly true.
 * A decline does not call `write`, so no star API request is made.
 */
export async function withConfirmedStarWrite<T>(opts: {
  confirmed: boolean;
  write: () => Promise<T>;
}): Promise<{ confirmed: true; value: T } | { confirmed: false }> {
  if (opts.confirmed !== true) return { confirmed: false };
  const value = await opts.write();
  return { confirmed: true, value };
}
