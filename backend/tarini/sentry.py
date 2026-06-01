"""Sentry error tracking — gated on SENTRY_DSN.

A no-op when SENTRY_DSN is unset, so local dev and tests never phone home. When set
(prod), it captures unhandled errors with light tracing. Operator PII (names, phone
numbers) is never sent — send_default_pii stays False.
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def init_sentry() -> bool:
    """Initialise Sentry if SENTRY_DSN is set. Returns True when active, False when skipped.

    sentry-sdk auto-enables its FastAPI/Starlette integrations when those frameworks are
    importable, so no integration wiring is needed here.
    """
    dsn = os.environ.get("SENTRY_DSN", "").strip()
    if not dsn:
        return False

    try:
        import sentry_sdk
    except ImportError:
        logger.warning("SENTRY_DSN is set but sentry-sdk is not installed — skipping Sentry init")
        return False

    sentry_sdk.init(
        dsn=dsn,
        environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
        release=os.environ.get("SENTRY_RELEASE") or None,
        # Light, cheap tracing on the free tier; override via env if needed.
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        # Operator names / contact details are sensitive — never attach PII to events.
        send_default_pii=False,
    )
    logger.info(
        "Sentry initialised (environment=%s)",
        os.environ.get("SENTRY_ENVIRONMENT", "production"),
    )
    return True
