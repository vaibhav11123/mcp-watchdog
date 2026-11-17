import * as vscode from 'vscode';
import { starViaGhOrBrowser, repoHttpsUrl } from './githubStar';
import * as telemetry from './telemetry/client';
import {
  FEEDBACK_ISSUES_URL,
  FIX_DEFER_TIMEOUT_MS,
  RATE_MESSAGE,
  RATE_PROMPT_DISABLED,
  REVIEW_ASK_DELAY_MS,
  choiceTriggersGithubStarWrite,
  resolveOpenStrategy,
  shouldOfferAsk,
  type OpenStrategy,
  type ReviewAskChoice,
} from './reviewAskCore';

export const ASKED_REVIEW_KEY = 'mcpWatchdog.askedReview';
export const RECOVERY_COUNT_KEY = 'mcpWatchdog.recoveryCount';

let askInFlight = false;
let fixQuickPickOpen = false;
let pendingReviewAsk = false;
let pendingTimer: ReturnType<typeof setTimeout> | undefined;
let contextRef: vscode.ExtensionContext | undefined;

export function notifyFixQuickPickOpen(open: boolean): void {
  fixQuickPickOpen = open;
  if (!open && pendingReviewAsk && contextRef) {
    pendingReviewAsk = false;
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = undefined;
    }
    void scheduleReviewAsk(contextRef, 'recovery');
  }
}

export function initReviewAsk(context: vscode.ExtensionContext): void {
  contextRef = context;
}

export function disposeReviewAsk(): void {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = undefined;
  contextRef = undefined;
  askInFlight = false;
  pendingReviewAsk = false;
}

type ReviewSource = 'recovery' | 'preview' | 'command';

async function softOpenExternal(url: string): Promise<void> {
  try {
    await vscode.env.openExternal(vscode.Uri.parse(url));
  } catch {
    /* offline / blocked — never throw */
  }
}

async function runGithubStarLeg(context: vscode.ExtensionContext): Promise<void> {
  try {
    let method = await starViaGhOrBrowser(context, { silent: true });
    if (method === 'silent_skipped') {
      method = await starViaGhOrBrowser(context, { silent: false });
    }
    void method;
    telemetry.track('review_surface_opened', { surface: 'github_star' });
  } catch {
    try {
      await softOpenExternal(repoHttpsUrl(context));
      telemetry.track('review_surface_opened', { surface: 'github_star' });
    } catch {
      /* ignore */
    }
  }
}

async function runStoreLeg(strategy: OpenStrategy): Promise<void> {
  if (strategy.kind === 'extension_open') {
    try {
      await vscode.commands.executeCommand('extension.open', strategy.extensionId);
      telemetry.track('review_surface_opened', { surface: 'extension_open' });
      return;
    } catch {
      await softOpenExternal(strategy.fallbackUrl);
      telemetry.track('review_surface_opened', { surface: 'marketplace' });
      return;
    }
  }
  await softOpenExternal(strategy.url);
  telemetry.track('review_surface_opened', { surface: 'openvsx' });
}

/** Unified Rate: GitHub star leg + one store hop. */
export async function runRateWatchdog(context: vscode.ExtensionContext): Promise<void> {
  await runGithubStarLeg(context);
  const strategy = resolveOpenStrategy(vscode.env.appName || '');
  await runStoreLeg(strategy);
}

async function presentAsk(context: vscode.ExtensionContext, source: ReviewSource): Promise<void> {
  const strategy = resolveOpenStrategy(vscode.env.appName || '');
  telemetry.track('review_ask_shown', { source });

  const pick = await vscode.window.showInformationMessage(
    RATE_MESSAGE,
    strategy.rateLabel,
    'Not now',
    'Send feedback',
  );

  let choice: ReviewAskChoice = 'dismiss';
  if (pick === strategy.rateLabel) choice = 'rate';
  else if (pick === 'Send feedback') choice = 'feedback';

  telemetry.track('review_ask_choice', { choice });

  if (choiceTriggersGithubStarWrite(choice)) {
    await runRateWatchdog(context);
  } else if (choice === 'feedback') {
    await softOpenExternal(FEEDBACK_ISSUES_URL);
    telemetry.track('review_surface_opened', { surface: 'issues' });
  }
  // Not now / dismiss: no GitHub star write
}

function scheduleReviewAsk(context: vscode.ExtensionContext, source: ReviewSource): void {
  if (context.extensionMode === vscode.ExtensionMode.Test && source === 'recovery') {
    // Host tests: still allow explicit preview/command; skip delayed recovery UI.
    return;
  }
  setTimeout(
    () => {
      void (async () => {
        try {
          await presentAsk(context, source);
        } finally {
          askInFlight = false;
        }
      })();
    },
    source === 'preview' || source === 'command' ? 0 : REVIEW_ASK_DELAY_MS,
  );
}

/**
 * Recovery path: count + one-shot latch before UI; defer if Fix Quick Pick is open.
 */
export async function maybeAskForReview(context: vscode.ExtensionContext): Promise<void> {
  const threshold = vscode.workspace
    .getConfiguration('mcpWatchdog')
    .get<number>('reviewAfterRecoveries', 3);

  const askedReview = context.globalState.get<boolean>(ASKED_REVIEW_KEY) === true;
  const recoveryCount = context.globalState.get<number>(RECOVERY_COUNT_KEY) ?? 0;

  const gate = shouldOfferAsk({
    threshold: threshold ?? 3,
    askedReview,
    recoveryCount,
    askInFlight,
  });

  if (gate.action === 'noop') return;

  if (gate.action === 'count_only') {
    await context.globalState.update(RECOVERY_COUNT_KEY, gate.nextCount);
    return;
  }

  // offer — latch before any await so concurrent recoveries cannot double-prompt
  askInFlight = true;
  await context.globalState.update(RECOVERY_COUNT_KEY, gate.nextCount);
  await context.globalState.update(ASKED_REVIEW_KEY, true);

  if (fixQuickPickOpen) {
    pendingReviewAsk = true;
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      pendingReviewAsk = false;
      askInFlight = false;
      pendingTimer = undefined;
    }, FIX_DEFER_TIMEOUT_MS);
    return;
  }

  scheduleReviewAsk(context, 'recovery');
}

export async function showReviewAskPreview(context: vscode.ExtensionContext): Promise<void> {
  const enabled = vscode.workspace
    .getConfiguration('mcpWatchdog')
    .get<boolean>('enableReviewAskPreview', false);
  if (!enabled) {
    void vscode.window.showInformationMessage(RATE_PROMPT_DISABLED);
    return;
  }
  await context.globalState.update(ASKED_REVIEW_KEY, false);
  askInFlight = true;
  await context.globalState.update(ASKED_REVIEW_KEY, true);
  scheduleReviewAsk(context, 'preview');
}

export async function showRateCommand(context: vscode.ExtensionContext): Promise<void> {
  // Volunteer path — does not require / clear interruptive latch semantics beyond running Rate
  await runRateWatchdog(context);
}

export function registerReviewAskCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('mcpWatchdog.rateWatchdog', () => showRateCommand(context)),
    vscode.commands.registerCommand('mcpWatchdog.showReviewAskPreview', () =>
      showReviewAskPreview(context),
    ),
  ];
}
