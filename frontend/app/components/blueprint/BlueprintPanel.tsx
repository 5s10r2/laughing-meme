"use client";

import { useCallback, useEffect, useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { renderRegisteredComponent } from "../../lib/component-registry";

type Props = Record<string, unknown>;

interface ModelResponse {
  blueprint?: Record<string, Props>;
  completeness?: { counts?: Record<string, number> };
}

interface BlueprintPanelProps {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
  /** tap-to-act passthrough (drill-downs etc.) */
  sendMessage?: (text: string) => void;
  /** bump to force a refetch (e.g. after Tarini changes the model while open) */
  refreshKey?: number;
}

/**
 * The Blueprint — an on-demand, live view of the whole property, read straight from
 * the model via GET /api/model (no LLM). It renders the same projected components the
 * chat emits (MassingModel, FloorLedger…), but in a persistent surface that updates in
 * place — so state stops piling up as stale cards in the transcript.
 *
 * Stage 1: read-only (massing + per-floor ledger with drill-down). Direct editing
 * (mapping/rename via the command endpoint) lands in Stage 2.
 */
export function BlueprintPanel({ open, onClose, sessionId, sendMessage, refreshKey }: BlueprintPanelProps) {
  const [data, setData] = useState<ModelResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/model?session_id=${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error("model fetch failed");
      setData((await res.json()) as ModelResponse);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Refetch whenever the panel opens or the model changes underneath it.
  useEffect(() => {
    if (open) load();
  }, [open, load, refreshKey]);

  const bp = data?.blueprint ?? {};
  const floors = data?.completeness?.counts?.floors ?? 0;

  let body: React.ReactNode;
  if (loading && !data) {
    body = <p className="py-10 text-center text-sm text-content-tertiary">Loading your building…</p>;
  } else if (error) {
    body = <p className="py-10 text-center text-sm text-content-tertiary">Couldn’t load the blueprint. Try reopening it.</p>;
  } else if (floors === 0) {
    body = (
      <p className="py-10 text-center text-sm text-content-tertiary">
        Nothing to show yet — tell Tarini about your floors and rooms, and your building will take
        shape here.
      </p>
    );
  } else {
    body = (
      <div className="space-y-4">
        {bp.MassingModel && renderRegisteredComponent("MassingModel", bp.MassingModel, sendMessage)}
        {bp.UnmappedWarning && renderRegisteredComponent("UnmappedWarning", bp.UnmappedWarning, sendMessage)}
        {bp.FloorLedger && renderRegisteredComponent("FloorLedger", bp.FloorLedger, sendMessage)}
      </div>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Building blueprint" className="lp-theme">
      {body}
    </BottomSheet>
  );
}
