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

/** Button / command copy must disclose the GitHub star write — never a generic "Rate". */
export const RATE_ACTION_MARKETPLACE = 'Star on GitHub + open Marketplace';
export const RATE_ACTION_OPENVSX = 'Star on GitHub + open Open VSX';

export function resolveOpenStrategy(appName: string): OpenStrategy {
  const store = resolvePrimaryStore(appName);
  if (store === 'marketplace') {
    return {
      kind: 'extension_open',
      extensionId: EXTENSION_ID,
      fallbackUrl: MARKETPLACE_URL,
      rateLabel: RATE_ACTION_MARKETPLACE,
    };
  }
  return {
    kind: 'open_external',
    url: OPEN_VSX_URL,
    rateLabel: RATE_ACTION_OPENVSX,
  };
}

/** Only the disclosed Rate action may trigger a GitHub star write. */
export function choiceTriggersGithubStarWrite(choice: ReviewAskChoice): boolean {
  return choice === 'rate';
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
