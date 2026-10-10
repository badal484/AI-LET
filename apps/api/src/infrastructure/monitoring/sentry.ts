import * as Sentry from '@sentry/node';

/**
 * Error tracking (sentry.io). Off unless SENTRY_DSN is set. Server errors (5xx), crashes and worker job
 * failures are reported with the route and a request id — never request bodies or chat text.
 */
let enabled = false;

export function initSentry(service: 'api' | 'worker'): void {
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn || enabled) return;
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    release: process.env['RENDER_GIT_COMMIT'] ?? process.env['GIT_COMMIT'],
    serverName: service,
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? 0),
    // Chat text and personal data must never leave: drop request bodies and cookies.
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) delete event.request.headers['authorization'];
      }
      return event;
    },
  });
  enabled = true;
}

export function reportError(err: unknown, context?: Record<string, string | number | undefined>): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    for (const [k, v] of Object.entries(context ?? {})) if (v !== undefined) scope.setTag(k, String(v));
    Sentry.captureException(err);
  });
}

export async function flushSentry(): Promise<void> {
  if (enabled) await Sentry.flush(2000).catch(() => undefined);
}
