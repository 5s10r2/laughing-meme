"""Sentry init is gated on SENTRY_DSN — a no-op (and never raises) when unset."""
from __future__ import annotations

from tarini.sentry import init_sentry


def test_init_sentry_noop_without_dsn(monkeypatch):
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    assert init_sentry() is False


def test_init_sentry_noop_with_blank_dsn(monkeypatch):
    monkeypatch.setenv("SENTRY_DSN", "   ")
    assert init_sentry() is False
