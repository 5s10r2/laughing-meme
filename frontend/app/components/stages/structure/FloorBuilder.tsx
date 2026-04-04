"use client";

import { useState } from "react";
import { Layers, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../../lib/cn";
import { motion } from "framer-motion";
import { CARD, ICON_SM } from "../../ui/primitives";

interface UnitBreakdown {
  category: string;
  label: string;
  count: number;
}

interface FloorData {
  index: number;
  label: string;
  active: boolean;
  unitCount?: number;
  nameRange?: string;
  unitBreakdown?: UnitBreakdown[];
}

interface FloorBuilderProps {
  floors: FloorData[];
  highlightFloor?: number;
}

/** Thresholds for adaptive display */
const TIGHT_THRESHOLD = 7;
const SANDWICH_THRESHOLD = 11;
const SANDWICH_TOP = 3;
const SANDWICH_BOTTOM = 2;

function formatUnitSummary(floor: FloorData): string {
  if (floor.unitBreakdown && floor.unitBreakdown.length > 0) {
    const nonZero = floor.unitBreakdown.filter((b) => b.count > 0);
    if (nonZero.length > 1) {
      return nonZero.map((b) => `${b.count} ${b.label.toLowerCase()}`).join(", ");
    }
    if (nonZero.length === 1) {
      return `${nonZero[0].count} ${nonZero[0].label.toLowerCase()}`;
    }
  }
  if (floor.unitCount != null) {
    return `${floor.unitCount} room${floor.unitCount !== 1 ? "s" : ""}`;
  }
  return "";
}

function FloorRow({
  floor,
  highlighted,
  tight,
}: {
  floor: FloorData;
  highlighted: boolean;
  tight: boolean;
}) {
  const summary = formatUnitSummary(floor);
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 rounded-xl transition-colors cursor-pointer",
        tight ? "py-2" : "py-3",
        highlighted
          ? "bg-accent/8 border border-accent/20"
          : "bg-bg-elevated hover:bg-bg-subtle"
      )}
    >
      <div className={cn(ICON_SM, "bg-accent/10 text-accent-lighter text-[10px] font-bold")}>
        {floor.index === 0 ? "G" : floor.index}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-content font-medium">{floor.label}</p>
        {summary && (
          <p className="text-[11px] text-content-tertiary">
            {summary}
            {floor.nameRange && ` \u00b7 ${floor.nameRange}`}
          </p>
        )}
      </div>
    </div>
  );
}

export function FloorBuilder({ floors: rawFloors, highlightFloor, ...rest }: FloorBuilderProps & Record<string, unknown>) {
  const [expanded, setExpanded] = useState(false);

  // Defensive: handle missing/malformed floors from Claude
  const rawList = Array.isArray(rawFloors)
    ? rawFloors
    : Array.isArray((rest as Record<string, unknown>).items)
      ? ((rest as Record<string, unknown>).items as FloorData[])
      : [];

  const floors: FloorData[] = (rawList as unknown[]).map((raw: unknown, i: number) => {
    if (typeof raw === "string") return { index: i, label: raw, active: true };
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
      index: (f.index ?? f.floor_index ?? i) as number,
      label: (f.label || f.name || f.floor || f.floor_label || `Floor ${i}`) as string,
      active: f.active !== undefined ? Boolean(f.active) : true,
      unitCount: (f.unitCount || f.unit_count || f.rooms || f.count) as number | undefined,
      nameRange: (f.nameRange || f.name_range || f.range) as string | undefined,
      unitBreakdown,
    };
  });

  if (!floors.length) return null;

  // Display floors top-to-bottom (highest floor first) like a building
  const sortedFloors = [...floors].sort((a, b) => (b.index ?? 0) - (a.index ?? 0));
  const total = sortedFloors.length;
  const isTight = total >= TIGHT_THRESHOLD;
  const isSandwich = total >= SANDWICH_THRESHOLD;

  // Compute total unit summary for header
  const hasBreakdowns = floors.some((f) => f.unitBreakdown && f.unitBreakdown.length > 1);
  const totalUnits = floors.reduce((sum, f) => sum + (f.unitCount ?? 0), 0);
  let headerSuffix = "";
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
      headerSuffix = ` \u00b7 ${parts.join(", ")}`;
    }
  }

  // ── Sandwich slicing ──
  const topSlice = isSandwich && !expanded ? sortedFloors.slice(0, SANDWICH_TOP) : [];
  const bottomSlice = isSandwich && !expanded ? sortedFloors.slice(-SANDWICH_BOTTOM) : [];
  const hiddenCount = isSandwich && !expanded ? total - SANDWICH_TOP - SANDWICH_BOTTOM : 0;

  // Rows to render
  const visibleRows = isSandwich && !expanded
    ? null // handled via top/bottom slices
    : sortedFloors;

  return (
    <div className={cn(CARD, "my-2")}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-content-tertiary">Building structure</p>
        <span className="text-sm font-bold text-content">
          {totalUnits > 0 ? `${totalUnits} rooms` : `${total} floor${total !== 1 ? "s" : ""}${headerSuffix}`}
        </span>
      </div>

      <div className={cn("space-y-1.5", isTight && !isSandwich && "space-y-1")}>
        {/* ── Full list (< SANDWICH_THRESHOLD or expanded) ── */}
        {visibleRows &&
          visibleRows.map((floor, i) => (
            <motion.div
              key={floor.index}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
            >
              <FloorRow
                floor={floor}
                highlighted={highlightFloor === floor.index}
                tight={isTight}
              />
            </motion.div>
          ))}

        {/* ── Sandwich mode (>= SANDWICH_THRESHOLD and collapsed) ── */}
        {!visibleRows && (
          <>
            {topSlice.map((floor, i) => (
              <motion.div
                key={floor.index}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
              >
                <FloorRow
                  floor={floor}
                  highlighted={highlightFloor === floor.index}
                  tight
                />
              </motion.div>
            ))}

            {/* Collapsed middle */}
            <button
              onClick={() => setExpanded(true)}
              className={cn(
                "w-full flex items-center justify-center gap-1.5",
                "py-2.5 my-0.5 rounded-xl",
                "text-xs text-content-tertiary hover:text-accent-lighter",
                "bg-bg-elevated/20 hover:bg-bg-elevated border border-dashed border-border/50",
                "transition-all cursor-pointer"
              )}
            >
              <ChevronDown className="w-3 h-3" />
              <span>{hiddenCount} more floor{hiddenCount !== 1 ? "s" : ""}</span>
            </button>

            {bottomSlice.map((floor, i) => (
              <motion.div
                key={floor.index}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (SANDWICH_TOP + 1 + i) * 0.05, duration: 0.2 }}
              >
                <FloorRow
                  floor={floor}
                  highlighted={highlightFloor === floor.index}
                  tight
                />
              </motion.div>
            ))}
          </>
        )}
      </div>

      {/* Collapse toggle when expanded from sandwich */}
      {isSandwich && expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="flex items-center gap-1 mt-2 text-xs text-content-tertiary hover:text-content-secondary transition-colors mx-auto cursor-pointer"
        >
          <ChevronUp className="w-3 h-3" />
          <span>Show less</span>
        </button>
      )}
    </div>
  );
}
