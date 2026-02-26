"use client";

import { Building2 } from "lucide-react";
import { cn } from "../../../lib/cn";

interface FloorSummary {
  label: string;
  unitCount: number;
  nameRange?: string;
}

interface StructureSummaryCardProps {
  propertyName?: string;
  totalFloors: number;
  totalUnits: number;
  floors: FloorSummary[];
  onSendMessage?: (text: string) => void;
}

export function StructureSummaryCard({
  propertyName,
  totalFloors: rawTotalFloors,
  totalUnits: rawTotalUnits,
  floors: rawFloors,
  onSendMessage,
  ...rest
}: StructureSummaryCardProps & Record<string, unknown>) {
  // Defensive: handle various floor shapes Claude might send
  const floors: FloorSummary[] = Array.isArray(rawFloors)
    ? (rawFloors as unknown[]).map((raw: unknown) => {
        if (typeof raw === "string") return { label: raw, unitCount: 0 };
        const f = raw as Record<string, unknown>;
        return {
          label: (f.label || f.name || f.floor || String(f)) as string,
          unitCount: (f.unitCount || f.unit_count || f.rooms || f.count || 0) as number,
          nameRange: (f.nameRange || f.name_range || f.range) as string | undefined,
        };
      })
    : [];

  const totalFloors = rawTotalFloors || floors.length || 0;
  const totalUnits = rawTotalUnits || floors.reduce((sum, f) => sum + (f.unitCount || 0), 0) || 0;

  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-xl px-4 py-3.5 my-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-4 h-4 text-amber-400/70" />
        <div>
          <p className="text-xs font-semibold text-zinc-200">
            {propertyName || "Property"} Structure
          </p>
          <p className="text-[10px] text-zinc-500">
            {totalFloors} floor{totalFloors !== 1 ? "s" : ""}, {totalUnits} room{totalUnits !== 1 ? "s" : ""} total
          </p>
        </div>
      </div>

      {/* Floor table */}
      <div className="space-y-1 mb-3">
        {floors.map((floor, idx) => (
          <div
            key={floor.label || idx}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-800/30 text-xs"
          >
            <span className="text-zinc-300 font-medium">{floor.label}</span>
            <div className="flex items-center gap-2 text-zinc-500">
              <span>{floor.unitCount} room{floor.unitCount !== 1 ? "s" : ""}</span>
              {floor.nameRange && (
                <span className="text-zinc-600 text-[10px]">({floor.nameRange})</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-zinc-800">
        <button
          onClick={() => onSendMessage?.("Looks right, let's move on")}
          className={cn(
            "flex-1 px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-amber-500/15 text-amber-300 border border-amber-500/25",
            "hover:bg-amber-500/25 active:scale-[0.98] transition-all"
          )}
        >
          Looks right, let&apos;s continue
        </button>
        <button
          onClick={() => onSendMessage?.("I need to change something")}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 border border-zinc-700 hover:bg-zinc-800 active:scale-[0.98] transition-all"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
