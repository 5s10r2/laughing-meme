"use client";

import { useState } from "react";
import { Layers, ChevronDown, ChevronUp, Check, ArrowRight } from "lucide-react";
import { cn } from "../../../lib/cn";
import { BottomSheet } from "../../ui/BottomSheet";
import {
  CARD, CARD_DIVIDER, ICON_CIRCLE, ICON_SM, BTN_PRIMARY, EditButton,
} from "../../ui/primitives";

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

    while (j < floors.length && formatFloorUnits(floors[j]) === currentText) {
      j++;
    }

    const count = j - i;
    if (count >= 2) {
      const groupFloors = floors.slice(i, j);
      const firstLabel = groupFloors[0].label;
      const lastLabel = groupFloors[count - 1].label;
      groups.push({
        label: `${firstLabel} \u2013 ${lastLabel}`,
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
    <div className={cn(CARD, "my-2")}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-medium text-content-tertiary">Structure</p>
          <p className="text-base font-semibold text-content mt-1">{propertyName || "Property"}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-content">{totalUnits}</p>
          <p className="text-[11px] text-content-tertiary">rooms</p>
        </div>
      </div>

      {/* Floor table */}
      <div className="space-y-0">
        {visibleGroups.map((group, idx) => (
          <div
            key={group.label || idx}
            className={cn(
              "flex items-center justify-between py-3.5",
              idx < visibleGroups.length - 1 && CARD_DIVIDER
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(ICON_CIRCLE, "bg-bg-elevated")}>
                <Layers className="w-4 h-4 text-content-tertiary" />
              </div>
              <div>
                <p className="text-sm text-content font-medium">{group.label}</p>
                <p className="text-[11px] text-content-tertiary mt-0.5">
                  {group.unitsText}
                  {group.nameRange && ` \u00b7 ${group.nameRange}`}
                </p>
              </div>
            </div>
            <div className={cn(ICON_SM, "bg-success/12")}>
              <Check className="w-3 h-3 text-success" />
            </div>
          </div>
        ))}

        {/* Expand toggle */}
        {hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1 w-full justify-center py-2.5 text-xs text-content-tertiary hover:text-accent-lighter transition-colors cursor-pointer"
          >
            <ChevronDown className="w-3 h-3" />
            <span>{hiddenCount} more floor{hiddenCount !== 1 ? " groups" : ""}</span>
          </button>
        )}

        {expanded && shouldCollapse && (
          <button
            onClick={() => setExpanded(false)}
            className="flex items-center gap-1 w-full justify-center py-1 text-xs text-content-tertiary hover:text-content-secondary transition-colors cursor-pointer"
          >
            <ChevronUp className="w-3 h-3" />
            <span>Show less</span>
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5">
        <button
          onClick={() => onSendMessage?.("Looks right, let's continue to packages")}
          className={BTN_PRIMARY}
        >
          <span className="inline-flex items-center gap-2">
            Confirm & continue <ArrowRight className="w-4 h-4" />
          </span>
        </button>
      </div>

      {/* BottomSheet for full structure view */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={`${propertyName || "Property"} \u2014 All Floors`}
      >
        <div className="space-y-0">
          {floors.map((floor, idx) => {
            const unitsText = formatFloorUnits(floor);
            return (
              <div
                key={floor.label || idx}
                className={cn(
                  "flex items-center justify-between py-3.5",
                  idx < floors.length - 1 && CARD_DIVIDER
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(ICON_CIRCLE, "bg-bg-elevated")}>
                    <Layers className="w-4 h-4 text-content-tertiary" />
                  </div>
                  <div>
                    <p className="text-sm text-content font-medium">{floor.label}</p>
                    <p className="text-[11px] text-content-tertiary mt-0.5">
                      {unitsText}
                      {floor.nameRange && ` \u00b7 ${floor.nameRange}`}
                    </p>
                  </div>
                </div>
                <EditButton
                  onClick={() => {
                    const text = formatFloorUnits(floor);
                    onSendMessage?.(
                      `I want to change ${floor.label}, it currently has ${text}${floor.nameRange ? ` (${floor.nameRange})` : ""}`
                    );
                    setSheetOpen(false);
                  }}
                />
              </div>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
