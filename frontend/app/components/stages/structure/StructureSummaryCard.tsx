"use client";

import { useState } from "react";
import { Building2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../../lib/cn";
import { BottomSheet } from "../../ui/BottomSheet";

interface UnitBreakdown {
  category: string;
  label: string;
  count: number;
}

interface FloorSummary {
  label: string;
  unitCount: number;
  nameRange?: string;
  unitBreakdown?: UnitBreakdown[];
}

interface StructureSummaryCardProps {
  propertyName?: string;
  totalFloors: number;
  totalUnits: number;
  floors: FloorSummary[];
  onSendMessage?: (text: string) => void;
}

/** Threshold for collapsing the floor table */
const COLLAPSE_THRESHOLD = 6;
const VISIBLE_ROWS = 3;

function formatFloorUnits(floor: FloorSummary): string {
  if (floor.unitBreakdown && floor.unitBreakdown.length > 0) {
    const nonZero = floor.unitBreakdown.filter((b) => b.count > 0);
    if (nonZero.length > 1) {
      return nonZero.map((b) => `${b.count} ${b.label.toLowerCase()}`).join(", ");
    }
    if (nonZero.length === 1) {
      return `${nonZero[0].count} ${nonZero[0].label.toLowerCase()}`;
    }
  }
  return `${floor.unitCount} room${floor.unitCount !== 1 ? "s" : ""}`;
}

/** Group consecutive floors with identical config into ranges */
function groupConsecutiveFloors(
  floors: FloorSummary[]
): { label: string; unitsText: string; nameRange?: string; floors: FloorSummary[] }[] {
  if (floors.length <= 3) {
    return floors.map((f) => ({
      label: f.label,
      unitsText: formatFloorUnits(f),
      nameRange: f.nameRange,
      floors: [f],
    }));
  }

  const groups: { label: string; unitsText: string; nameRange?: string; floors: FloorSummary[] }[] = [];
  let i = 0;

  while (i < floors.length) {
    const current = floors[i];
    const currentText = formatFloorUnits(current);
    let j = i + 1;

    // Find consecutive floors with same unit config
    while (j < floors.length && formatFloorUnits(floors[j]) === currentText) {
      j++;
    }

    const count = j - i;
    if (count >= 2) {
      // Group them
      const groupFloors = floors.slice(i, j);
      const firstLabel = groupFloors[0].label;
      const lastLabel = groupFloors[count - 1].label;
      groups.push({
        label: `${firstLabel} – ${lastLabel}`,
        unitsText: `${currentText} each`,
        floors: groupFloors,
      });
    } else {
      groups.push({
        label: current.label,
        unitsText: currentText,
        nameRange: current.nameRange,
        floors: [current],
      });
    }
    i = j;
  }

  return groups;
}

function FloorRow({
  label,
  unitsText,
  nameRange,
  onChangeClick,
}: {
  label: string;
  unitsText: string;
  nameRange?: string;
  onChangeClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 text-xs">
      <span className="text-content-secondary font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-content-tertiary">
          {unitsText}
          {nameRange && (
            <span className="text-content-tertiary text-xs ml-1">({nameRange})</span>
          )}
        </span>
        <button
          onClick={onChangeClick}
          className="text-xs text-content-tertiary hover:text-accent-light underline-offset-2 hover:underline transition-colors cursor-pointer px-2 py-1.5 -mr-2 -my-1.5 rounded"
        >
          change
        </button>
      </div>
    </div>
  );
}

export function StructureSummaryCard({
  propertyName,
  totalFloors: rawTotalFloors,
  totalUnits: rawTotalUnits,
  floors: rawFloors,
  onSendMessage,
  ...rest
}: StructureSummaryCardProps & Record<string, unknown>) {
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Defensive: handle various floor shapes Claude might send
  const floors: FloorSummary[] = Array.isArray(rawFloors)
    ? (rawFloors as unknown[]).map((raw: unknown) => {
        if (typeof raw === "string") return { label: raw, unitCount: 0 };
        const f = raw as Record<string, unknown>;

        const rawBreakdown = f.unitBreakdown || f.unit_breakdown || f.breakdown;
        const unitBreakdown: UnitBreakdown[] | undefined = Array.isArray(rawBreakdown)
          ? (rawBreakdown as unknown[]).map((b: unknown) => {
              const item = b as Record<string, unknown>;
              return {
                category: (item.category || item.type || "room") as string,
                label: (item.label || item.name || "Rooms") as string,
                count: Number(item.count ?? 0),
              };
            })
          : undefined;

        return {
          label: (f.label || f.name || f.floor || String(f)) as string,
          unitCount: Number(
            f.unitCount ?? f.unit_count ?? f.units ?? f.rooms ?? f.room_count ??
            (Array.isArray(f.unit_names) ? f.unit_names.length : undefined) ??
            (Array.isArray(f.room_names) ? f.room_names.length : undefined) ??
            f.count ?? 0
          ),
          nameRange: (f.nameRange || f.name_range || f.range) as string | undefined,
          unitBreakdown,
        };
      })
    : [];

  const totalFloors = rawTotalFloors || floors.length || 0;
  const totalUnits = rawTotalUnits || floors.reduce((sum, f) => sum + (f.unitCount || 0), 0) || 0;

  // Build multi-type totals for header
  const hasBreakdowns = floors.some((f) => f.unitBreakdown && f.unitBreakdown.length > 1);
  let headerUnitsText = `${totalUnits} room${totalUnits !== 1 ? "s" : ""} total`;

  if (hasBreakdowns) {
    const totals = new Map<string, { label: string; count: number }>();
    for (const floor of floors) {
      if (floor.unitBreakdown) {
        for (const b of floor.unitBreakdown) {
          const existing = totals.get(b.category);
          if (existing) {
            existing.count += b.count;
          } else {
            totals.set(b.category, { label: b.label, count: b.count });
          }
        }
      } else if (floor.unitCount) {
        const existing = totals.get("room");
        if (existing) {
          existing.count += floor.unitCount;
        } else {
          totals.set("room", { label: "Rooms", count: floor.unitCount });
        }
      }
    }
    const parts = Array.from(totals.values())
      .filter((t) => t.count > 0)
      .map((t) => `${t.count} ${t.label.toLowerCase()}`);
    if (parts.length > 1) {
      headerUnitsText = `${parts.join(", ")} total`;
    }
  }

  // Group consecutive identical floors for compact display
  const groupedFloors = groupConsecutiveFloors(floors);
  const shouldCollapse = groupedFloors.length >= COLLAPSE_THRESHOLD;
  const visibleGroups = shouldCollapse && !expanded
    ? groupedFloors.slice(0, VISIBLE_ROWS)
    : groupedFloors;
  const hiddenCount = shouldCollapse && !expanded
    ? groupedFloors.length - VISIBLE_ROWS
    : 0;

  return (
    <div className="border border-border border-l-2 border-l-accent/30 bg-bg-surface rounded-[var(--radius-card)] px-4 py-3.5 my-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-4 h-4 text-accent-light/70" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-content">
            {propertyName || "Property"} Structure
          </p>
          <p className="text-xs text-content-tertiary">
            {totalFloors} floor{totalFloors !== 1 ? "s" : ""}, {headerUnitsText}
          </p>
        </div>
        {/* View all button for large structures */}
        {shouldCollapse && (
          <button
            onClick={() => setSheetOpen(true)}
            className="text-[11px] text-content-tertiary hover:text-accent-light transition-colors flex-shrink-0"
          >
            View all
          </button>
        )}
      </div>

      {/* Floor table */}
      <div className="space-y-0 mb-3">
        {visibleGroups.map((group, idx) => (
          <FloorRow
            key={group.label || idx}
            label={group.label}
            unitsText={group.unitsText}
            nameRange={group.nameRange}
            onChangeClick={() => {
              const firstFloor = group.floors[0];
              const text = formatFloorUnits(firstFloor);
              onSendMessage?.(
                `I want to change ${group.label}, it currently has ${text}${firstFloor.nameRange ? ` (${firstFloor.nameRange})` : ""}`
              );
            }}
          />
        ))}

        {/* Expand toggle */}
        {hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1 w-full justify-center py-2 text-xs text-content-tertiary hover:text-accent-light transition-colors"
          >
            <ChevronDown className="w-3 h-3" />
            <span>{hiddenCount} more floor{hiddenCount !== 1 ? " groups" : ""}</span>
          </button>
        )}

        {expanded && shouldCollapse && (
          <button
            onClick={() => setExpanded(false)}
            className="flex items-center gap-1 w-full justify-center py-1 text-xs text-content-tertiary hover:text-content-secondary transition-colors"
          >
            <ChevronUp className="w-3 h-3" />
            <span>Show less</span>
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="pt-2 border-t border-border">
        <button
          onClick={() => onSendMessage?.("Looks right, let's continue to packages")}
          className={cn(
            "w-full px-3 py-2.5 rounded-[var(--radius-button)] text-[13px] font-semibold",
            "bg-accent/20 text-accent-lighter border border-accent/25",
            "hover:bg-accent/25 active:scale-[0.98] transition-all"
          )}
        >
          Confirm &amp; continue →
        </button>
      </div>

      {/* BottomSheet for full structure view */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={`${propertyName || "Property"} — All Floors`}
      >
        <div className="space-y-0">
          {floors.map((floor, idx) => {
            const unitsText = formatFloorUnits(floor);
            return (
              <div
                key={floor.label || idx}
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 text-xs"
              >
                <span className="text-content-secondary font-medium">{floor.label}</span>
                <span className="text-content-tertiary">
                  {unitsText}
                  {floor.nameRange && (
                    <span className="text-content-tertiary ml-1">({floor.nameRange})</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
