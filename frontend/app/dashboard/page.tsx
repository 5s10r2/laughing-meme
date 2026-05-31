"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Funnel dashboard — a read-only "are operators completing onboarding, and where do they drop"
 * view for the solo CPO. Derives the funnel from stored snapshots via /api/funnel (gated by a
 * shared token). Visit /dashboard?token=… (the token is stored locally after first use).
 */

type Stage = { key: string; label: string; count: number; pctOfStarted: number; dropFromPrev: number };
type Funnel = { sessionsTotal: number; engaged: number; published: number; stages: Stage[] };

export default function DashboardPage() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<Funnel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Pick up ?token= once, fall back to a stored token.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("token");
    const t = fromUrl || localStorage.getItem("funnel_token") || "";
    if (t) setToken(t);
  }, []);

  const load = useCallback(async (t: string) => {
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/funnel?token=${encodeURIComponent(t)}`, { cache: "no-store" });
      if (!res.ok) {
        setError(res.status === 401 ? "Wrong token." : res.status === 404 ? "Funnel is disabled (no FUNNEL_TOKEN set)." : "Couldn’t load.");
        setData(null);
        return;
      }
      localStorage.setItem("funnel_token", t);
      setData((await res.json()) as Funnel);
    } catch {
      setError("Backend unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) load(token);
  }, [token, load]);

  return (
    <div className="min-h-screen bg-bg-deep text-content px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-baseline justify-between">
          <h1 className="text-xl font-semibold">Onboarding funnel</h1>
          <button
            type="button"
            onClick={() => load(token)}
            className="text-xs text-content-secondary hover:text-content cursor-pointer"
          >
            Refresh
          </button>
        </div>

        {!token && (
          <TokenPrompt onSubmit={(t) => setToken(t)} />
        )}

        {token && loading && <p className="text-sm text-content-tertiary">Loading…</p>}
        {token && error && (
          <div className="rounded-xl border border-border bg-bg-surface p-4 text-sm text-content-secondary">
            {error}
            <button type="button" onClick={() => setToken("")} className="ml-2 text-accent hover:underline cursor-pointer">
              change token
            </button>
          </div>
        )}

        {data && (
          <>
            <div className="mb-6 flex gap-6 text-sm">
              <Stat label="Sessions" value={data.sessionsTotal} />
              <Stat label="Engaged" value={data.engaged} />
              <Stat label="Published" value={data.published} />
            </div>
            <div className="space-y-3">
              {data.stages.map((s, i) => (
                <div key={s.key}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-content">{s.label}</span>
                    <span className="font-mono text-content-secondary">
                      {s.count}
                      <span className="text-content-tertiary"> · {s.pctOfStarted}%</span>
                      {i > 0 && s.dropFromPrev > 0 && (
                        <span className="text-error ml-2">−{s.dropFromPrev}</span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-bg-surface">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${Math.max(s.pctOfStarted, s.count > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[11px] text-content-tertiary">
              Cumulative — each stage counts every session that reached at least that far. Derived
              live from stored snapshots.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-semibold text-content">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-content-tertiary">{label}</div>
    </div>
  );
}

function TokenPrompt({ onSubmit }: { onSubmit: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <div className="rounded-xl border border-border bg-bg-surface p-4">
      <label className="mb-2 block text-sm text-content-secondary">Enter the funnel token</label>
      <div className="flex gap-2">
        <input
          type="password"
          value={t}
          onChange={(e) => setT(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit(t)}
          className="flex-1 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-content focus:border-border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onSubmit(t)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white cursor-pointer"
        >
          View
        </button>
      </div>
    </div>
  );
}
