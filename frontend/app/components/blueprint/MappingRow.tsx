"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/cn";
import { CARD } from "../ui/primitives";
import { FloorComposition, type CompositionSegment } from "./FloorComposition";
import { RoomChip } from "./RoomChip";
import { cap, plural } from "./tokens";

/**
 * MappingRow — assign packages to a floor's rooms (design system §5.4).
 *
 * Select rooms (tap chips, or a quick-select), then pick a package; the
 * assignment is sent to Tarini as an intent (view+intent — the AI mutates the
 * model, the UI re-projects). Unmapped rooms are surfaced via a neutral segment
 * in the mix bar and a quick-select, never silently dropped.
 *
 * Built on the keystone: the top bar is FloorComposition re-skinned by PACKAGE
 * (the same primitive the structure stage skins by type), so "different packages
 * in one floor" reads at a glance. Props are trusted (validated upstream).
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
}

interface MappingRowProps {
  floorLabel: string;
  units: MappingUnit[];
  packages: MappingPackage[];
  /** singular noun for the unit (room / flat / bed / unit); backend-projected */
  unitNoun?: string;
  onSendMessage?: (text: string) => void;
  /** Direct-edit mode (Blueprint panel): emit a typed command applied instantly
   *  via the command layer. When absent, falls back to a chat intent (onSendMessage). */
  onApplyCommands?: (commands: Record<string, unknown>[]) => void;
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

export function MappingRow({ floorLabel, units, packages, unitNoun = "room", onSendMessage, onApplyCommands }: MappingRowProps) {
  const [selected, setSelected] = useState<Set<string | number>>(new Set());

  // A room is "mapped" only if its packageId resolves to a real package; a
  // dangling reference counts as unmapped (not silently impersonating pkg #0).
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

  const total = units.length;
  const mappedCount = units.filter(isMapped).length;
  const hasUnmapped = mappedCount < total;

  // distinct room types present → "by type" quick-selects
  const types = useMemo(() => {
    const seen: string[] = [];
    for (const u of units) if (!seen.includes(u.category)) seen.push(u.category);
    return seen;
  }, [units]);

  // package-mix bar (+ an "Unmapped" segment) — FloorComposition re-skinned by package
  const segments = useMemo<CompositionSegment[]>(() => {
    const segs = packages.map((p) => ({
      key: p.id,
      label: p.name,
      count: units.filter((u) => u.packageId === p.id).length,
      color: pkgColor(p.id),
    }));
    const unmapped = total - mappedCount;
    if (unmapped > 0) {
      segs.push({ key: "__unmapped", label: "Unmapped", count: unmapped, color: UNMAPPED_COLOR });
    }
    return segs;
  }, [packages, units, total, mappedCount, pkgColor]);

  // Reconcile selection when units re-project (LLM-fed): drop ids no longer present.
  useEffect(() => {
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string | number>();
      for (const id of prev) {
        if (units.some((u) => u.id === id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [units]);

  const toggle = useCallback((id: string | number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectUnmapped = useCallback(
    () => setSelected(new Set(units.filter((u) => !isMapped(u)).map((u) => u.id))),
    [units, isMapped]
  );
  const selectType = useCallback(
    (category: string) =>
      setSelected(new Set(units.filter((u) => u.category === category).map((u) => u.id))),
    [units]
  );
  const clear = useCallback(() => setSelected(new Set()), []);

  function assign(pkg: MappingPackage) {
    const chosen = units.filter((u) => selected.has(u.id));
    if (chosen.length === 0) return;
    if (onApplyCommands) {
      // Direct edit — applied instantly via the command layer, no chat round-trip.
      onApplyCommands([{ op: "MapRooms", room_ids: chosen.map((u) => u.id), package_id: pkg.id }]);
    } else {
      onSendMessage?.(`Assign ${chosen.map((u) => u.name).join(", ")} on ${floorLabel} to ${pkg.name}`);
    }
    clear();
  }

  return (
    <div className={CARD}>
      {/* header */}
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-semibold text-content">{floorLabel}</p>
        <span className="text-[11px] font-mono text-content-secondary">
          {selected.size > 0 ? `${selected.size} selected` : `${mappedCount}/${total} mapped`}
        </span>
      </div>

      {/* package-mix bar (re-skinned by package) */}
      <FloorComposition segments={segments} showLegend className="mb-4" />

      {/* quick-selects */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {hasUnmapped && (
          <QuickChip onClick={selectUnmapped} accent>
            Unmapped ({total - mappedCount})
          </QuickChip>
        )}
        {types.length > 1 &&
          types.map((t) => (
            <QuickChip key={t} onClick={() => selectType(t)}>
              {cap(t)}
            </QuickChip>
          ))}
        {selected.size > 0 && <QuickChip onClick={clear}>Clear</QuickChip>}
      </div>

      {/* room chips — selectable */}
      <div className="flex flex-wrap gap-1.5">
        {units.map((u) => {
          const mapped = isMapped(u);
          return (
            <RoomChip
              key={u.id}
              label={u.name}
              ariaLabel={`${cap(unitNoun)} ${u.name}, ${mapped ? `assigned ${packages[pkgIndex.get(u.packageId!)!].name}` : "unmapped"}`}
              dotColor={mapped ? pkgColor(u.packageId!) : null}
              selected={selected.has(u.id)}
              dashed={!mapped}
              onClick={() => toggle(u.id)}
            />
          );
        })}
      </div>

      {/* package picker — appears when rooms are selected */}
      {selected.size > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          {/* Tapping a room reveals what it is + its current package. */}
          {selected.size === 1 && (() => {
            const u = units.find((x) => selected.has(x.id));
            if (!u) return null;
            const i = u.packageId ? pkgIndex.get(u.packageId) : undefined;
            const current = i !== undefined ? packages[i].name : null;
            return (
              <p className="text-xs text-content-secondary mb-2">
                <span className="font-semibold text-content">{u.name}</span>
                {" · "}{cap(u.category)}
                {" · "}
                <span className={current ? "text-content-secondary" : "text-content-tertiary"}>
                  {current ? `currently ${current}` : "unmapped"}
                </span>
              </p>
            );
          })()}
          <p className="text-[11px] text-content-tertiary mb-2">
            Assign {selected.size} {plural(unitNoun, selected.size)} to:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {packages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => assign(p)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium",
                  "bg-bg-elevated border border-border text-content cursor-pointer",
                  "hover:border-border-strong active:scale-95 transition-colors"
                )}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: pkgColor(p.id) }}
                  aria-hidden="true"
                />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
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
        "px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer transition-colors",
        accent
          ? "text-accent border-border-accent hover:bg-accent/10"
          : "text-content-secondary border-border hover:bg-bg-elevated"
      )}
    >
      {children}
    </button>
  );
}
