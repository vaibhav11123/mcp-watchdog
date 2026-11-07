/**
 * Product telemetry (PostHog Capture). Empty API key → no-op client.
 * Project API key is write-oriented (public client key); rotate in PostHog if leaked.
 * Host must match project region (us.i / eu.i) or events are silently rejected.
 * Self-host later: swap POSTHOG_HOST to your instance Capture base.
 */
export const POSTHOG_API_KEY = 'phc_C7QLn8TYYfxKZSdf3o4TGpnZMTLkURzyLtWDfaiAqKkD';

/** Ingestion host without trailing slash (US Cloud — matches project region). */
export const POSTHOG_HOST = 'https://us.i.posthog.com';

export const CAPTURE_PATH = '/i/v0/e/';
export const FETCH_TIMEOUT_MS = 2000;
export const STATE_TRANSITION_MIN_MS = 30_000;

export const INSTALL_ID_KEY = 'mcpWatchdog.installId';
export const SETTING_ENABLED = 'telemetry.enabled';
