"use client";

import { useMemo } from "react";
import { cn } from "../../lib/cn";
import { CARD } from "../ui/primitives";
import { FloorComposition, type CompositionSegment } from "./FloorComposition";
import { RoomChip } from "./RoomChip";
import { cap } from "./tokens";

/**
 * MappingRow — one floor's rooms, as selectable chips (design system §5.4).
 *
 * Presentational: selection lives in the parent {@link BlueprintMapping} so it
 * spans floors and feeds ONE sticky action bar (the package picker no longer
 * lives inline per floor). Each chip toggles the global selection; the per-floor
 * quick-selects ADD this floor's matching rooms to it. The package-mix bar shows
 * only once a floor has a real mix (≥1 priced) — an all-unpriced bar carries no
 * proportional information, so it's suppressed to keep the card lean.
 */

export interface MappingUnit {
  id: string | number;
  name: string;
  category: string; // room type — for the by-type quick-select
  packageId?: string; // current assignment, if any
}

export interface MappingPackage {
  id: string;
  name: string;
  /** chip/segment colour; falls back to a palette by index */
  color?: string;
  /** monthly rent (or per the billing period) — surfaced on the assign buttons */
  rent?: number | null;
  /** billing period for the rent suffix (weekly/daily/monthly) */
  billingPeriod?: string | null;
}

const UNMAPPED_COLOR = "var(--border-strong)";

interface MappingRowProps {
  floorLabel: string;
  units: MappingUnit[];
  packages: MappingPackage[];
  /** singular noun for the unit (room / flat / bed / unit); backend-projected */
  unitNoun?: string;
  /** package id → palette index, for name/colour lookups (owned by the parent) */
  pkgIndex: Map<string, number>;
  /** resolve a package id to its colour (owned by the parent so colours agree everywhere) */
  pkgColor: (id: string) => string;
  isMapped: (u: MappingUnit) => boolean;
  /** the parent's cross-floor selection */
  selected: Set<string | number>;
  /** toggle one room in the global selection */
  onToggle: (id: string | number) => void;
  /** add a set of rooms (a quick-select) to the global selection */
  onAddIds: (ids: (string | number)[]) => void;
}

export function MappingRow({
  floorLabel,
  units,
  packages,
  unitNoun = "room",
  pkgIndex,
  pkgColor,
  isMapped,
  selected,
  onToggle,
  onAddIds,
}: MappingRowProps) {
  const total = units.length;
  const mappedCount = units.filter(isMapped).length;
  const hasUnmapped = mappedCount < total;
  const selectedHere = units.filter((u) => selected.has(u.id)).length;
  // A floor with a real mix (≥1 priced) is the only time the proportional bar means
  // something; while everything is unpriced the bar + legend are pure restatement.
  const showComposition = mappedCount > 0;

  // distinct room types present → "by type" quick-selects (only when mixed)
  const types = useMemo(() => {
    const seen: string[] = [];
    for (const u of units) if (!seen.includes(u.category)) seen.push(u.category);
    return seen;
  }, [units]);

  const segments = useMemo<CompositionSegment[]>(() => {
    const segs = packages.map((p) => ({
      key: p.id,
      label: p.name,
      count: units.filter((u) => u.packageId === p.id).length,
      color: pkgColor(p.id),
    }));
    const unmapped = total - mappedCount;
    if (unmapped > 0) {
      segs.push({ key: "__unmapped", label: "Unpriced", count: unmapped, color: UNMAPPED_COLOR });
    }
    return segs;
  }, [packages, units, total, mappedCount, pkgColor]);

  return (
    <div className={CARD}>
      {/* header — floor + a single status signal (selection count lives in the action bar) */}
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-semibold text-content">{floorLabel}</p>
        <span className="text-[11px] font-mono text-content-secondary">
          {selectedHere > 0 ? `${selectedHere} selected` : `${mappedCount}/${total} priced`}
        </span>
      </div>

      {/* package-mix bar — only once there's an actual mix to show */}
      {showComposition && <FloorComposition segments={segments} showLegend className="mb-4" />}

      {/* quick-selects — add this floor's matching rooms to the global selection */}
      {(hasUnmapped || types.length > 1) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {hasUnmapped && (
            <QuickChip onClick={() => onAddIds(units.filter((u) => !isMapped(u)).map((u) => u.id))} accent>
              Select unpriced ({total - mappedCount})
            </QuickChip>
          )}
          {types.length > 1 &&
            types.map((t) => (
              <QuickChip key={t} onClick={() => onAddIds(units.filter((u) => u.category === t).map((u) => u.id))}>
                {cap(t)}
              </QuickChip>
            ))}
        </div>
      )}

      {/* room chips — selectable, cross-floor */}
      <div className="flex flex-wrap gap-2">
        {units.map((u) => {
          const mapped = isMapped(u);
          return (
            <RoomChip
              key={u.id}
              label={u.name}
              typeTag={types.length > 1 ? cap(u.category) : undefined}
              ariaLabel={`${cap(unitNoun)} ${u.name}, ${mapped ? `priced ${packages[pkgIndex.get(u.packageId!)!].name}` : "unpriced"}`}
              dotColor={mapped ? pkgColor(u.packageId!) : null}
              selected={selected.has(u.id)}
              dashed={!mapped}
              onClick={() => onToggle(u.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function QuickChip({
  children,
  onClick,
  accent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 min-h-[36px] rounded-full text-[11px] font-medium border cursor-pointer transition-colors",
        accent
          ? "text-accent border-border-accent hover:bg-accent/10"
          : "text-content-secondary border-border hover:bg-bg-elevated"
      )}
    >
      {children}
    </button>
  );
}
