// Browser-side Sentry — gated on NEXT_PUBLIC_SENTRY_DSN. A no-op when unset, so dev
// and unconfigured deploys never phone home. Activates automatically once the DSN is set.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "production",
    tracesSampleRate: 0.1,
    // Operator PII must never leave our infra.
    sendDefaultPii: false,
  });
}

// Required by @sentry/nextjs for navigation instrumentation; safe no-op without a DSN.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
