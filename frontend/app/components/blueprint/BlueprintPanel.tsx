"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { BlueprintMapping, type BlueprintMappingFloor } from "./BlueprintMapping";
import { MassingModel } from "./MassingModel";
import { FloorLedger } from "./FloorLedger";
import { PackagePanel, type PackageDetail } from "./PackagePanel";
import { OfferingEditSheet } from "./OfferingEditSheet";
import { PublishChecklist } from "./PublishChecklist";
import type { MappingPackage } from "./MappingRow";
import { adaptComponentProps } from "../../lib/component-adapters";
import { cap, plural } from "./tokens";
import { cn } from "../../lib/cn";

type Props = Record<string, unknown>;

interface ModelResponse {
  blueprint?: Record<string, Props>;
  completeness?: { counts?: Record<string, number>; publishable?: boolean; open_items?: string[] };
  version?: number;
  model?: { floors?: { id: string | number; index: number }[] };
}

type BlueprintTab = "packages" | "rooms";

interface BlueprintPanelProps {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
  /** tap-to-act passthrough (drill-downs etc.) */
  sendMessage?: (text: string) => void;
  /** bump to force a refetch (e.g. after Tarini changes the model while open) */
  refreshKey?: number;
  /** notify the chat that a direct Blueprint edit succeeded (for a toast + transcript note) */
  onEdit?: (summary: string) => void;
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
export function BlueprintPanel({ open, onClose, sessionId, sendMessage, refreshKey, onEdit }: BlueprintPanelProps) {
  const [data, setData] = useState<ModelResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // The floor the massing tap is directing attention to (expands its ledger row).
  const [activeFloorId, setActiveFloorId] = useState<string | number | undefined>(undefined);
  // Jump-nav: which section is shown (Packages vs Rooms). Avoids the long scroll.
  const [tab, setTab] = useState<BlueprintTab>("packages");
  // The offering whose edit sheet is open (null = closed).
  const [editingOfferingId, setEditingOfferingId] = useState<string | null>(null);
  // Re-triggerable scroll signal (set by a massing floor tap; applied post-render).
  const [scrollFloorId, setScrollFloorId] = useState<string | number | null>(null);
  const [scrollNonce, setScrollNonce] = useState(0);
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
    async (commands: Record<string, unknown>[], summary?: string) => {
      if (!sessionId) return;
      try {
        const res = await fetch("/api/commands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, commands, expected_version: data?.version }),
        });
        if (!res.ok) {
          // A rejected edit (stale version 409, bad command 4xx, etc.) must NOT blank the
          // whole panel — re-sync to current state so the view stays live and the user can retry.
          await load();
          return;
        }
        setData((await res.json()) as ModelResponse);
        // Talk and touch are the same: leave a trace of the tap in the conversation.
        if (summary) onEdit?.(summary);
      } catch {
        await load();
      }
    },
    [sessionId, data?.version, load, onEdit]
  );

  // Massing floor tap → jump to that floor's detail row. The massing reports a
  // ground-relative index (0 = ground); resolve it to the domain floor id via the
  // model's floors (sorted ascending), then scroll + flash the matching row.
  const jumpToFloor = useCallback(
    (groundIndex: number) => {
      const sorted = [...(data?.model?.floors ?? [])].sort((a, b) => a.index - b.index);
      const floor = sorted[groundIndex];
      if (!floor) return;
      setTab("rooms"); // the floor rows live under Rooms
      setActiveFloorId(floor.id); // expand this floor's ledger row
      setScrollFloorId(floor.id);
      setScrollNonce((n) => n + 1); // apply the scroll after the tab/section renders
    },
    [data?.model?.floors]
  );

  // Scroll + flash the target floor row AFTER the tab switch has rendered it.
  useEffect(() => {
    if (scrollNonce === 0 || scrollFloorId == null || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(`[data-floor-id="${scrollFloorId}"]`);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.remove("lp-flash");
    void row.offsetWidth; // restart the animation if re-tapped
    row.classList.add("lp-flash");
  }, [scrollNonce, scrollFloorId]);

  const bp = data?.blueprint ?? {};
  // singular unit noun (room / flat / bed / unit) — backend-projected; "room" for the
  // legacy shape that doesn't send it, so the panel reads right on either backend.
  const unitNoun = String(bp.MassingModel?.unitNoun ?? bp.FloorLedger?.unitNoun ?? "room");
  // recursive-tree backend ⇒ the model carries a root_id; direct edits must emit tree commands.
  const treeMode = !!(data?.model && "root_id" in (data.model as Record<string, unknown>));
  const counts = data?.completeness?.counts ?? {};
  // structure exists if the model reports floors (flat Property shape) OR rentable units
  // (recursive tree shape) — keeps the panel shape-agnostic across both backends.
  const hasStructure = (counts.floors ?? 0) > 0 || (counts.rentable ?? 0) > 0;
  const publishable = data?.completeness?.publishable ?? false;
  const openItems = data?.completeness?.open_items ?? [];
  const mapping = bp.BlueprintMapping as
    | { packages?: MappingPackage[]; floors?: BlueprintMappingFloor[] }
    | undefined;
  const hasPackages = !!mapping?.packages && mapping.packages.length > 0;

  let body: React.ReactNode;
  if (loading && !data) {
    body = <p className="py-10 text-center text-sm text-content-tertiary">Loading your building…</p>;
  } else if (error) {
    body = <p className="py-10 text-center text-sm text-content-tertiary">Couldn’t load the blueprint. Try reopening it.</p>;
  } else if (!hasStructure) {
    body = (
      <p className="py-10 text-center text-sm text-content-tertiary">
        Nothing to show yet — tell Tarini about your floors and units, and your building will take
        shape here.
      </p>
    );
  } else {
    const ledger = bp.FloorLedger && (
      <FloorLedger
        {...(adaptComponentProps("FloorLedger", bp.FloorLedger) as unknown as React.ComponentProps<typeof FloorLedger>)}
        activeId={activeFloorId}
        onSendMessage={sendMessage}
      />
    );

    body = (
      <div className="space-y-4" ref={listRef}>
        {bp.MassingModel && (
          <MassingModel
            {...(bp.MassingModel as React.ComponentProps<typeof MassingModel>)}
            state="settled"
            ready={publishable}
            onFloorClick={jumpToFloor}
          />
        )}

        {/* Honest "what's left" — subsumes the old single-purpose unmapped warning. */}
        <PublishChecklist items={openItems} publishable={publishable} />

        {hasPackages ? (
          <>
            {/* Jump-nav: tap to switch sections — no scrolling to find them. */}
            <div className="sticky top-0 z-10 -mx-1 bg-bg-surface px-1 py-1">
              <div className="flex gap-1 rounded-xl border border-border bg-bg-elevated p-1">
                {(["packages", "rooms"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cn(
                      "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                      tab === t
                        ? "bg-bg-surface text-content shadow-sm"
                        : "text-content-secondary hover:text-content"
                    )}
                  >
                    {t === "packages" ? "Packages" : cap(plural(unitNoun, 2))}
                  </button>
                ))}
              </div>
            </div>

            {tab === "packages"
              ? (
                <PackagePanel
                  packages={(bp.PackagePanel?.packages as PackageDetail[]) ?? []}
                  unitNoun={unitNoun}
                  onEdit={treeMode ? setEditingOfferingId : undefined}
                />
              )
              : (
                <BlueprintMapping
                  packages={mapping?.packages}
                  floors={mapping?.floors}
                  unitNoun={unitNoun}
                  treeMode={treeMode}
                  onApplyCommands={applyCommands}
                />
              )}
          </>
        ) : (
          // No packages yet → just the structure ledger (with drill-down).
          ledger
        )}
      </div>
    );
  }

  const editingOffering =
    (bp.PackagePanel?.packages as PackageDetail[] | undefined)?.find((p) => p.id === editingOfferingId) ?? null;

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Building blueprint" className="lp-theme">
        {body}
      </BottomSheet>
      <OfferingEditSheet
        offering={editingOffering}
        open={!!editingOffering}
        onClose={() => setEditingOfferingId(null)}
        onApply={applyCommands}
      />
    </>
  );
}
