"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "../../../lib/cn";
import { humanizeCategory } from "../../../lib/property-utils";
import { BottomSheet } from "../../ui/BottomSheet";
import { FloorChipBar } from "../../ui/FloorChipBar";

interface UnmappedUnit {
  name: string;
  category?: string;
}

interface UnmappedFloor {
  floorLabel: string;
  floorIndex: number;
  unitNames: string[];
  // NEW: structured units with category for grouped display
  units?: UnmappedUnit[];
}

interface UnmappedUnitsWarningProps {
  floors: UnmappedFloor[];
  totalUnmapped: number;
  onSendMessage?: (text: string) => void;
}

/** Threshold for switching from inline to aggregate + drill-down */
const AGGREGATE_THRESHOLD = 11;

export function UnmappedUnitsWarning({
  floors: rawFloors,
  totalUnmapped: rawTotalUnmapped,
  onSendMessage,
  ...rest
}: UnmappedUnitsWarningProps & Record<string, unknown>) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedFloorIdx, setSelectedFloorIdx] = useState(0);

  // Defensive: handle missing/malformed props from Claude
  const floors: UnmappedFloor[] = Array.isArray(rawFloors)
    ? (rawFloors as unknown[]).map((raw: unknown, i: number) => {
        const f = raw as Record<string, unknown>;
        const rawNames = Array.isArray(f.unitNames) ? f.unitNames
          : Array.isArray(f.unit_names) ? f.unit_names
          : Array.isArray(f.units) ? (f.units as unknown[]).map((u: unknown) => {
              if (typeof u === "string") return u;
              return ((u as Record<string, string>).name || String(u));
            })
          : [];

        // Parse structured units with categories
        const rawUnits = f.units || f.unit_list;
        const units: UnmappedUnit[] | undefined = Array.isArray(rawUnits)
          ? (rawUnits as unknown[]).map((u: unknown) => {
              if (typeof u === "string") return { name: u };
              const obj = u as Record<string, unknown>;
              return {
                name: (obj.name || obj.unit_name || obj.label || String(obj)) as string,
                category: (obj.category || obj.type || obj.unit_type) as string | undefined,
              };
            })
          : undefined;

        return {
          floorLabel: (f.floorLabel || f.floor_label || f.floor || f.label || `Floor ${i}`) as string,
          floorIndex: (f.floorIndex ?? f.floor_index ?? i) as number,
          unitNames: rawNames as string[],
          units,
        };
      })
    : [];

  const totalUnmapped = rawTotalUnmapped || floors.reduce((sum, f) => sum + (f.units?.length || f.unitNames.length), 0) || 0;
  const useAggregate = totalUnmapped >= AGGREGATE_THRESHOLD;

  function renderFloorUnits(floor: UnmappedFloor) {
    // If structured units with categories exist, group by category
    const units: UnmappedUnit[] = floor.units && floor.units.length > 0
      ? floor.units
      : floor.unitNames.map((n) => ({ name: n }));

    const hasCategories = units.some((u) => u.category);

    if (hasCategories) {
      const groupMap = new Map<string, string[]>();
      for (const u of units) {
        const cat = u.category || "other";
        if (!groupMap.has(cat)) groupMap.set(cat, []);
        groupMap.get(cat)!.push(u.name);
      }

      return (
        <div className="space-y-1.5">
          {Array.from(groupMap.entries()).map(([cat, names]) => (
            <div key={cat}>
              <p className="text-[11px] text-content-tertiary mb-0.5">
                {humanizeCategory(cat)} ({names.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {names.map((name) => (
                  <span
                    key={name}
                    className="px-2 py-0.5 rounded bg-warning-surface border border-warning/20 text-[11px] text-warning"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Flat view (no categories)
    return (
      <div className="flex flex-wrap gap-1">
        {units.map((u) => (
          <span
            key={u.name}
            className="px-2 py-0.5 rounded bg-warning-surface border border-warning/20 text-[11px] text-warning"
          >
            {u.name}
          </span>
        ))}
      </div>
    );
  }

  const selectedFloor = floors[selectedFloorIdx] || floors[0];

  return (
    <div className="border border-warning/25 bg-warning-surface rounded-[var(--radius-card)] px-4 py-3.5 my-2">
      <div className="flex items-center gap-2 mb-2.5">
        <AlertCircle className="w-3.5 h-3.5 text-warning" />
        <span className="text-xs font-semibold text-warning">
          {totalUnmapped} Unmapped Room{totalUnmapped !== 1 ? "s" : ""}
        </span>
      </div>

      <p className="text-xs text-content-secondary mb-3">
        Almost there! Assign a package to these rooms to continue.
      </p>

      {/* ── Inline view (< 11 unmapped) ── */}
      {!useAggregate && (
        <div className="space-y-2.5 mb-3">
          {floors.map((floor) => (
            <div key={floor.floorIndex}>
              <p className="text-xs text-content-tertiary font-medium mb-1">
                {floor.floorLabel}
              </p>
              {renderFloorUnits(floor)}
            </div>
          ))}
        </div>
      )}

      {/* ── Aggregate view (11+ unmapped) ── */}
      {useAggregate && (
        <div className="mb-3">
          {/* Summary */}
          <div className="px-3 py-2 rounded-[var(--radius-button)] bg-bg-elevated/30 border border-border mb-2">
            <p className="text-xs text-content font-medium mb-1">
              {totalUnmapped} unmapped rooms across {floors.length} floor{floors.length !== 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-1">
              {floors.map((f) => {
                const count = f.units?.length || f.unitNames.length;
                return (
                  <span
                    key={f.floorIndex}
                    className="px-2 py-0.5 rounded bg-warning-surface text-[11px] text-warning border border-warning/15"
                  >
                    {f.floorLabel}: {count}
                  </span>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => setSheetOpen(true)}
            className="text-xs text-warning hover:text-warning underline-offset-2 hover:underline transition-colors mb-2"
          >
            View details →
          </button>
        </div>
      )}

      <button
        onClick={() =>
          onSendMessage?.(`Help me assign packages to the remaining ${totalUnmapped} rooms`)
        }
        className={cn(
          "w-full px-3 py-1.5 rounded-[var(--radius-button)] text-xs font-medium",
          "bg-warning-surface text-warning border border-warning/25",
          "hover:bg-warning/25 active:scale-95 transition-all"
        )}
      >
        Help me assign the remaining rooms
      </button>

      {/* ── BottomSheet with FloorChipBar drill-down ── */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={`${totalUnmapped} Unmapped Rooms`}
      >
        <div>
          {/* FloorChipBar navigation */}
          <div className="mb-3">
            <FloorChipBar
              floors={floors.map((f, i) => ({
                index: i,
                label: f.floorLabel,
              }))}
              selected={selectedFloorIdx}
              onSelect={setSelectedFloorIdx}
            />
          </div>

          {/* Selected floor's unmapped units */}
          {selectedFloor && (
            <div>
              <p className="text-xs text-content-secondary mb-2">
                {selectedFloor.units?.length || selectedFloor.unitNames.length} unmapped on {selectedFloor.floorLabel}
              </p>
              {renderFloorUnits(selectedFloor)}
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
