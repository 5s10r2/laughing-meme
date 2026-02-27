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
          unitCount: Number(
            f.unitCount ?? f.unit_count ?? f.units ?? f.rooms ?? f.room_count ??
            (Array.isArray(f.unit_names) ? f.unit_names.length : undefined) ??
            (Array.isArray(f.room_names) ? f.room_names.length : undefined) ??
            f.count ?? 0
          ),
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
      <div className="space-y-0 mb-3">
        {floors.map((floor, idx) => (
          <div
            key={floor.label || idx}
            className="flex items-center justify-between py-1.5 border-b border-zinc-800/50 last:border-0 text-xs"
          >
            <span className="text-zinc-300 font-medium">{floor.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">
                {floor.unitCount} room{floor.unitCount !== 1 ? "s" : ""}
                {floor.nameRange && (
                  <span className="text-zinc-600 text-[10px] ml-1">({floor.nameRange})</span>
                )}
              </span>
              <button
                onClick={() =>
                  onSendMessage?.(
                    `I want to change ${floor.label}, it currently has ${floor.unitCount} rooms${floor.nameRange ? ` (${floor.nameRange})` : ""}`
                  )
                }
                className="text-[11px] text-zinc-500 hover:text-amber-400 underline-offset-2 hover:underline transition-colors cursor-pointer"
              >
                change
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="pt-2 border-t border-zinc-800">
        <button
          onClick={() => onSendMessage?.("Looks right, let's continue to packages")}
          className={cn(
            "w-full px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-amber-500/15 text-amber-300 border border-amber-500/25",
            "hover:bg-amber-500/25 active:scale-[0.98] transition-all"
          )}
        >
          Confirm &amp; continue →
        </button>
      </div>
    </div>
  );
}
