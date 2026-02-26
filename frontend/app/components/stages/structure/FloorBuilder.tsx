"use client";

import { Layers } from "lucide-react";
import { cn } from "../../../lib/cn";
import { motion } from "framer-motion";

interface FloorData {
  index: number;
  label: string;
  active: boolean;
  unitCount?: number;
  nameRange?: string;
}

interface FloorBuilderProps {
  floors: FloorData[];
  highlightFloor?: number;
}

export function FloorBuilder({ floors: rawFloors, highlightFloor, ...rest }: FloorBuilderProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed floors from Claude
  const rawList = Array.isArray(rawFloors)
    ? rawFloors
    : Array.isArray((rest as Record<string, unknown>).items)
      ? ((rest as Record<string, unknown>).items as FloorData[])
      : [];

  const floors: FloorData[] = (rawList as unknown[]).map((raw: unknown, i: number) => {
    if (typeof raw === "string") return { index: i, label: raw, active: true };
    const f = raw as Record<string, unknown>;
    return {
      index: (f.index ?? f.floor_index ?? i) as number,
      label: (f.label || f.name || f.floor || f.floor_label || `Floor ${i}`) as string,
      active: f.active !== undefined ? Boolean(f.active) : true,
      unitCount: (f.unitCount || f.unit_count || f.rooms || f.count) as number | undefined,
      nameRange: (f.nameRange || f.name_range || f.range) as string | undefined,
    };
  });

  if (!floors.length) return null;

  // Display floors top-to-bottom (highest floor first) like a building
  const sortedFloors = [...floors].sort((a, b) => (b.index ?? 0) - (a.index ?? 0));

  return (
    <div className="border border-zinc-800 bg-zinc-900/30 rounded-xl px-3 py-3 my-2">
      <div className="flex items-center gap-2 mb-2.5">
        <Layers className="w-3.5 h-3.5 text-amber-400/70" />
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
          Property Structure
        </span>
        <span className="text-[10px] text-zinc-600 ml-auto">
          {floors.length} floor{floors.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-1">
        {sortedFloors.map((floor, i) => (
          <motion.div
            key={floor.index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs",
              "border transition-all duration-200",
              highlightFloor === floor.index
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-transparent bg-zinc-800/40"
            )}
          >
            {/* Floor indicator */}
            <div
              className={cn(
                "w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                highlightFloor === floor.index
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-zinc-700/50 text-zinc-500"
              )}
            >
              {floor.index === 0 ? "G" : floor.index}
            </div>

            {/* Floor info */}
            <div className="flex-1 min-w-0">
              <span className="text-zinc-300 font-medium">{floor.label}</span>
            </div>

            {/* Unit count */}
            {floor.unitCount != null && (
              <div className="flex items-center gap-1 text-[10px] text-zinc-500 flex-shrink-0">
                <span>{floor.unitCount} room{floor.unitCount !== 1 ? "s" : ""}</span>
                {floor.nameRange && (
                  <span className="text-zinc-600">({floor.nameRange})</span>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
