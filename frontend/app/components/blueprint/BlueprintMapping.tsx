"use client";

import { useCallback, useMemo, useState } from "react";
import { MappingRow, type MappingPackage, type MappingUnit } from "./MappingRow";
import { cap, plural, rupees, periodSuffix } from "./tokens";

export interface BlueprintMappingFloor {
  floorId: string | number;
  floorLabel: string;
  units: MappingUnit[];
}

interface BlueprintMappingProps {
  packages?: MappingPackage[];
  floors?: BlueprintMappingFloor[];
  /** singular noun for the unit (room / flat / bed / unit); backend-projected */
  unitNoun?: string;
  /** true when the backend is the recursive Space tree → rows emit MapOffering, not MapRooms */
  treeMode?: boolean;
  onSendMessage?: (text: string) => void;
  /** Direct-edit mode (Blueprint panel) — applied instantly via the command layer. */
  onApplyCommands?: (commands: Record<string, unknown>[], summary?: string) => void;
}

const PKG_PALETTE = [
  "var(--t-single)",
  "var(--t-double)",
  "var(--t-deluxe)",
  "var(--t-triple)",
  "#8A7CC0",
  "#3F8E9B",
];
const UNMAPPED_COLOR = "var(--border-strong)";

/**
 * Mapping view — assign packages to rooms across the whole building.
 *
 * Selection is GLOBAL (not floor-siloed): tap rooms on any floor, or use a floor's
 * quick-selects to add its matching rooms, and a single STICKY action bar at the
 * bottom commits them all in one command. This makes cross-floor batch assignment
 * the default and gives the commit control one fixed home instead of an inline
 * picker that teleports per floor.
 */
export function BlueprintMapping({
  packages = [],
  floors = [],
  unitNoun = "room",
  treeMode = false,
  onSendMessage,
  onApplyCommands,
}: BlueprintMappingProps) {
  const [selected, setSelected] = useState<Set<string | number>>(new Set());

  const allUnits = useMemo(() => floors.flatMap((f) => f.units), [floors]);

  const pkgIndex = useMemo(() => {
    const m = new Map<string, number>();
    packages.forEach((p, i) => m.set(p.id, i));
    return m;
  }, [packages]);

  const isMapped = useCallback(
    (u: MappingUnit) => !!u.packageId && pkgIndex.has(u.packageId),
    [pkgIndex]
  );
  const pkgColor = useCallback(
    (id: string) => {
      const i = pkgIndex.get(id);
      if (i === undefined) return UNMAPPED_COLOR;
      return packages[i].color ?? PKG_PALETTE[i % PKG_PALETTE.length];
    },
    [pkgIndex, packages]
  );

  // Drop ids whose unit re-projected away (LLM edited the model underneath us).
  const validSelected = useMemo(() => {
    const ids = new Set(allUnits.map((u) => u.id));
    const next = new Set<string | number>();
    for (const id of selected) if (ids.has(id)) next.add(id);
    return next;
  }, [selected, allUnits]);

  const selectedUnits = useMemo(
    () => allUnits.filter((u) => validSelected.has(u.id)),
    [allUnits, validSelected]
  );

  const toggle = useCallback((id: string | number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addIds = useCallback((ids: (string | number)[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  function assign(pkg: MappingPackage) {
    if (selectedUnits.length === 0) return;
    const ids = selectedUnits.map((u) => u.id);
    if (onApplyCommands) {
      const summary =
        ids.length <= 3
          ? `Priced ${selectedUnits.map((u) => u.name).join(", ")} → ${pkg.name}${pkg.rent != null ? ` (${rupees(pkg.rent)}${periodSuffix(pkg.billingPeriod)})` : ""}`
          : `Priced ${ids.length} ${plural(unitNoun, ids.length)} → ${pkg.name}${pkg.rent != null ? ` (${rupees(pkg.rent)}${periodSuffix(pkg.billingPeriod)})` : ""}`;
      onApplyCommands(
        treeMode
          ? [{ op: "MapOffering", space_ids: ids, offering_id: pkg.id }]
          : [{ op: "MapRooms", room_ids: ids, package_id: pkg.id }],
        summary
      );
    } else {
      onSendMessage?.(`Assign ${ids.length} ${plural(unitNoun, ids.length)} to ${pkg.name}`);
    }
    clear();
  }

  if (floors.length === 0) return null;

  const one = selectedUnits.length === 1 ? selectedUnits[0] : null;
  const oneCurrent =
    one && one.packageId && pkgIndex.has(one.packageId) ? packages[pkgIndex.get(one.packageId)!].name : null;

  return (
    <div className="lp-theme">
      {/* floor stack — pad the bottom so the sticky bar never covers the last card */}
      <div className="space-y-3 pb-28">
        {floors.map((floor) => (
          // data-floor-id: a scroll/flash anchor for the massing-model floor tap.
          <div key={floor.floorId} data-floor-id={String(floor.floorId)}>
            <MappingRow
              floorLabel={floor.floorLabel}
              units={floor.units}
              packages={packages}
              unitNoun={unitNoun}
              pkgIndex={pkgIndex}
              pkgColor={pkgColor}
              isMapped={isMapped}
              selected={validSelected}
              onToggle={toggle}
              onAddIds={addIds}
            />
          </div>
        ))}
      </div>

      {/* sticky action bar — one fixed home for the commit, active whenever anything is selected */}
      {validSelected.size > 0 && (
        <div className="sticky bottom-0 z-20 -mx-1 border-t border-border bg-bg-surface/95 px-1 pb-2 pt-3 backdrop-blur shadow-[0_-6px_16px_rgba(0,0,0,0.08)]">
          <div className="mb-2 flex items-center justify-between px-1">
            {one ? (
              <p className="text-xs text-content-secondary">
                <span className="font-semibold text-content">{one.name}</span>
                {" · "}
                {cap(one.category)}
                {" · "}
                <span className="text-content-tertiary">{oneCurrent ? `currently ${oneCurrent}` : "unpriced"}</span>
              </p>
            ) : (
              <p className="text-xs font-medium text-content">
                Assign {validSelected.size} {plural(unitNoun, validSelected.size)} to:
              </p>
            )}
            <button
              type="button"
              onClick={clear}
              className="text-[11px] font-medium text-content-secondary hover:text-content cursor-pointer"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2 px-1">
            {packages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => assign(p)}
                className="inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl text-sm font-medium bg-bg-elevated border border-border text-content cursor-pointer hover:border-border-strong active:scale-95 transition-colors"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: pkgColor(p.id) }}
                  aria-hidden="true"
                />
                <span>{p.name}</span>
                {p.rent != null && (
                  <span className="text-content-secondary">
                    · {rupees(p.rent)}
                    {periodSuffix(p.billingPeriod)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
