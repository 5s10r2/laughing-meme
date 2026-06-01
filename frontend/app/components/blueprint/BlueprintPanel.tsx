"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { BlueprintMapping, type BlueprintMappingFloor } from "./BlueprintMapping";
import { MassingModel } from "./MassingModel";
import { FloorLedger } from "./FloorLedger";
import { PackagePanel, type PackageDetail } from "./PackagePanel";
import { OfferingEditSheet } from "./OfferingEditSheet";
import { FloorDetailSheet } from "./FloorDetailSheet";
import { UnitEditSheet } from "./UnitEditSheet";
import type { LedgerFloor, FloorUnit } from "./FloorTray";
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
  // Floor drill (ground-relative index from a massing tap) + the unit whose edit sheet is open.
  const [drillGroundIndex, setDrillGroundIndex] = useState<number | null>(null);
  const [editingUnit, setEditingUnit] = useState<FloorUnit | null>(null);
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
      // Tap a floor in the model → drill into its units (rename / mark unavailable). Works for
      // the recursive tree (resolved from the projected ledger). Also keep the legacy scroll for
      // the flat backend, which carries model.floors.
      setDrillGroundIndex(groundIndex);
      const sorted = [...(data?.model?.floors ?? [])].sort((a, b) => a.index - b.index);
      const floor = sorted[groundIndex];
      if (!floor) return;
      setActiveFloorId(floor.id);
      setScrollFloorId(floor.id);
      setScrollNonce((n) => n + 1);
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

  // Land on the work: when the panel opens and rooms still need pricing, default to
  // the Rooms tab; otherwise the Packages overview. One-shot per open so a manual
  // tab switch is never overridden by a later refetch.
  const tabInitRef = useRef(false);
  useEffect(() => {
    if (!open) {
      tabInitRef.current = false;
      return;
    }
    if (tabInitRef.current || !data) return;
    tabInitRef.current = true;
    const m = data.blueprint?.BlueprintMapping as
      | { packages?: { id: string }[]; floors?: { units?: { packageId?: string }[] }[] }
      | undefined;
    if (!m?.packages?.length) {
      setTab("packages");
      return;
    }
    const pkgIds = new Set(m.packages.map((p) => p.id));
    const units = (m.floors ?? []).flatMap((f) => f.units ?? []);
    const unmapped = units.filter((u) => !(u.packageId && pkgIds.has(u.packageId))).length;
    setTab(unmapped > 0 ? "rooms" : "packages");
  }, [open, data]);

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

  // The full package definitions (carry rent, terms, etc.) — used by the Packages tab
  // and to enrich the mapping packages so the assign buttons can show the rent.
  const pkgDetails = (bp.PackagePanel?.packages as PackageDetail[] | undefined) ?? [];
  const enrichedPackages: MappingPackage[] = (mapping?.packages ?? []).map((p) => {
    const d = pkgDetails.find((x) => x.id === p.id);
    return { ...p, rent: d?.rent ?? null, billingPeriod: d?.billingPeriod ?? null };
  });

  // Building-wide mapping progress — drives the title and the Rooms-tab progress line.
  const mappingPkgIds = new Set((mapping?.packages ?? []).map((p) => p.id));
  const mappingUnits = (mapping?.floors ?? []).flatMap((f) => f.units ?? []);
  const totalUnits = mappingUnits.length;
  const mappedUnits = mappingUnits.filter((u) => u.packageId && mappingPkgIds.has(u.packageId)).length;
  const unmappedUnits = totalUnits - mappedUnits;

  // Adapted ledger floors (colour-injected) — reused by the ledger view and the floor drill.
  const adaptedLedger = bp.FloorLedger ? adaptComponentProps("FloorLedger", bp.FloorLedger) : null;
  const adaptedFloors = (adaptedLedger?.floors as LedgerFloor[] | undefined) ?? [];
  // Massing tap gives a ground-relative index (0 = ground); ledger floors are top-down.
  const drillFloor = drillGroundIndex != null ? ([...adaptedFloors].reverse()[drillGroundIndex] ?? null) : null;

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
    const ledger = adaptedLedger && (
      <FloorLedger
        {...(adaptedLedger as unknown as React.ComponentProps<typeof FloorLedger>)}
        activeId={activeFloorId}
        onSendMessage={sendMessage}
      />
    );

    const massing = bp.MassingModel && (
      <MassingModel
        {...(bp.MassingModel as React.ComponentProps<typeof MassingModel>)}
        state="settled"
        ready={publishable}
        onFloorClick={jumpToFloor}
      />
    );
    const checklist = <PublishChecklist items={openItems} publishable={publishable} />;

    body = (
      <div className="space-y-4" ref={listRef}>
        {hasPackages ? (
          <>
            {/* Jump-nav (sticky): switch sections without scrolling to find them. */}
            <div className="sticky top-0 z-10 -mx-1 bg-bg-surface px-1 py-1">
              <div className="flex gap-1 rounded-xl border border-border bg-bg-elevated p-1">
                {(["rooms", "packages"] as const).map((t) => (
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

            {tab === "rooms" ? (
              // Rooms tab leads with the work — no decorative hero in the way.
              <>
                {totalUnits > 0 && (
                  <p className="px-1 text-[11px] font-mono text-content-secondary">
                    {mappedUnits} of {totalUnits} {plural(unitNoun, totalUnits)} priced
                  </p>
                )}
                <BlueprintMapping
                  packages={enrichedPackages}
                  floors={mapping?.floors}
                  unitNoun={unitNoun}
                  treeMode={treeMode}
                  onApplyCommands={applyCommands}
                />
              </>
            ) : (
              // Packages tab is the overview — the massing model + what's-left live here.
              <>
                {massing}
                {checklist}
                <PackagePanel
                  packages={pkgDetails}
                  unitNoun={unitNoun}
                  onEdit={treeMode ? setEditingOfferingId : undefined}
                />
              </>
            )}
          </>
        ) : (
          // No packages yet → massing + what's-left + the structure ledger (drill-down).
          <>
            {massing}
            {checklist}
            {ledger}
          </>
        )}
      </div>
    );
  }

  const editingOffering =
    (bp.PackagePanel?.packages as PackageDetail[] | undefined)?.find((p) => p.id === editingOfferingId) ?? null;

  // Name the job when there's pricing to do; fall back to the neutral title otherwise.
  const sheetTitle = hasPackages && unmappedUnits > 0 ? "Price your rooms" : "Building blueprint";

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={sheetTitle} className="lp-theme">
        {body}
      </BottomSheet>
      <OfferingEditSheet
        offering={editingOffering}
        open={!!editingOffering}
        onClose={() => setEditingOfferingId(null)}
        onApply={applyCommands}
      />

      {/* Floor drill (from a massing floor tap) → tap a unit to edit it. */}
      <FloorDetailSheet
        floor={drillFloor}
        open={!!drillFloor}
        unitNoun={unitNoun}
        onClose={() => setDrillGroundIndex(null)}
        onSendMessage={sendMessage}
        onEditUnit={treeMode ? (u) => setEditingUnit(u) : undefined}
      />
      <UnitEditSheet
        unit={editingUnit}
        unitNoun={unitNoun}
        open={!!editingUnit}
        onClose={() => setEditingUnit(null)}
        onApply={applyCommands}
      />
    </>
  );
}
