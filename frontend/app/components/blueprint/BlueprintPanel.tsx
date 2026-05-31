"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { renderRegisteredComponent } from "../../lib/component-registry";
import { BlueprintMapping, type BlueprintMappingFloor } from "./BlueprintMapping";
import { MassingModel } from "./MassingModel";
import { FloorLedger } from "./FloorLedger";
import type { MappingPackage } from "./MappingRow";
import { adaptComponentProps } from "../../lib/component-adapters";

type Props = Record<string, unknown>;

interface ModelResponse {
  blueprint?: Record<string, Props>;
  completeness?: { counts?: Record<string, number> };
  version?: number;
  model?: { floors?: { id: string | number; index: number }[] };
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
  // The floor the massing tap is directing attention to (expands its ledger row).
  const [activeFloorId, setActiveFloorId] = useState<string | number | undefined>(undefined);
  const listRef = useRef<HTMLDivElement>(null);

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

  // Direct edit — apply through the command layer (no LLM) and swap in the fresh
  // snapshot so the panel updates in place. A version conflict (Tarini edited
  // concurrently) just refetches so the next attempt is against current state.
  const applyCommands = useCallback(
    async (commands: Record<string, unknown>[]) => {
      if (!sessionId) return;
      try {
        const res = await fetch("/api/commands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, commands, expected_version: data?.version }),
        });
        if (res.status === 409) {
          await load();
          return;
        }
        if (!res.ok) {
          setError(true);
          return;
        }
        setData((await res.json()) as ModelResponse);
      } catch {
        setError(true);
      }
    },
    [sessionId, data?.version, load]
  );

  // Massing floor tap → jump to that floor's detail row. The massing reports a
  // ground-relative index (0 = ground); resolve it to the domain floor id via the
  // model's floors (sorted ascending), then scroll + flash the matching row.
  const jumpToFloor = useCallback(
    (groundIndex: number) => {
      const sorted = [...(data?.model?.floors ?? [])].sort((a, b) => a.index - b.index);
      const floor = sorted[groundIndex];
      if (!floor || !listRef.current) return;
      setActiveFloorId(floor.id); // expand this floor's ledger row
      const row = listRef.current.querySelector<HTMLElement>(`[data-floor-id="${floor.id}"]`);
      if (!row) return;
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.classList.remove("lp-flash");
      void row.offsetWidth; // restart the animation if re-tapped
      row.classList.add("lp-flash");
    },
    [data?.model?.floors]
  );

  const bp = data?.blueprint ?? {};
  const floors = data?.completeness?.counts?.floors ?? 0;
  const mapping = bp.BlueprintMapping as
    | { packages?: MappingPackage[]; floors?: BlueprintMappingFloor[] }
    | undefined;
  const hasPackages = !!mapping?.packages && mapping.packages.length > 0;

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
      <div className="space-y-4" ref={listRef}>
        {bp.MassingModel && (
          <MassingModel
            {...(bp.MassingModel as React.ComponentProps<typeof MassingModel>)}
            state="settled"
            onFloorClick={jumpToFloor}
          />
        )}
        {bp.UnmappedWarning && renderRegisteredComponent("UnmappedWarning", bp.UnmappedWarning, sendMessage)}
        {/* Mapping is the active task once packages exist → editable, in place.
            Before that, show the structure ledger (with drill-down). */}
        {hasPackages ? (
          <BlueprintMapping
            packages={mapping?.packages}
            floors={mapping?.floors}
            onApplyCommands={applyCommands}
          />
        ) : (
          bp.FloorLedger && (
            <FloorLedger
              {...(adaptComponentProps("FloorLedger", bp.FloorLedger) as unknown as React.ComponentProps<typeof FloorLedger>)}
              activeId={activeFloorId}
              onSendMessage={sendMessage}
            />
          )
        )}
      </div>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Building blueprint" className="lp-theme">
      {body}
    </BottomSheet>
  );
}
