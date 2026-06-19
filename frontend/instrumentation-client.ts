import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: true,
    enabled: process.env.NODE_ENV === 'production',
    ignoreErrors: [
      // Benign browser quirks
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Mobile network reality — caught + surfaced to the user via
      // friendlyError(); not actionable as bugs. Real retry-exhaustion
      // failures throw 'Request timeout' instead and still reach Sentry.
      'Failed to fetch',
      'Load failed',
      // Third-party in-app browser / extension noise (not in this codebase;
      // stacktrace points at embed_script.js).
      'Timeout waiting for response',
    ],
    denyUrls: [
      // Third-party scripts injected by in-app browsers (Facebook, Instagram,
      // TikTok, etc.) load from app:// URLs. Their autofill / bridge scripts
      // crash on certain forms and have nothing to do with our code.
      /^app:\/\//,
      /webkit-masked-url:\/\//,
    ],
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
