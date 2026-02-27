"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "../../../lib/cn";

interface UnmappedFloor {
  floorLabel: string;
  floorIndex: number;
  unitNames: string[];
}

interface UnmappedUnitsWarningProps {
  floors: UnmappedFloor[];
  totalUnmapped: number;
  onSendMessage?: (text: string) => void;
}

export function UnmappedUnitsWarning({
  floors: rawFloors,
  totalUnmapped: rawTotalUnmapped,
  onSendMessage,
  ...rest
}: UnmappedUnitsWarningProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed props from Claude
  const floors: UnmappedFloor[] = Array.isArray(rawFloors)
    ? (rawFloors as unknown[]).map((raw: unknown, i: number) => {
        const f = raw as Record<string, unknown>;
        const rawNames = Array.isArray(f.unitNames) ? f.unitNames
          : Array.isArray(f.unit_names) ? f.unit_names
          : Array.isArray(f.units) ? (f.units as unknown[]).map((u: unknown) => typeof u === "string" ? u : ((u as Record<string, string>).name || String(u)))
          : [];
        return {
          floorLabel: (f.floorLabel || f.floor_label || f.floor || f.label || `Floor ${i}`) as string,
          floorIndex: (f.floorIndex ?? f.floor_index ?? i) as number,
          unitNames: rawNames as string[],
        };
      })
    : [];

  const totalUnmapped = rawTotalUnmapped || floors.reduce((sum, f) => sum + f.unitNames.length, 0) || 0;

  return (
    <div className="border border-orange-500/25 bg-orange-500/5 rounded-xl px-4 py-3.5 my-2">
      <div className="flex items-center gap-2 mb-2.5">
        <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
        <span className="text-xs font-semibold text-orange-300">
          {totalUnmapped} Unmapped Room{totalUnmapped !== 1 ? "s" : ""}
        </span>
      </div>

      <p className="text-[11px] text-zinc-400 mb-3">
        These rooms need a package assigned before you can continue.
      </p>

      <div className="space-y-2 mb-3">
        {floors.map((floor) => (
          <div key={floor.floorIndex}>
            <p className="text-[10px] text-zinc-500 font-medium mb-1">
              {floor.floorLabel}
            </p>
            <div className="flex flex-wrap gap-1">
              {floor.unitNames.map((name) => (
                <span
                  key={name}
                  className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-[10px] text-orange-300/80"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() =>
          onSendMessage?.(`Help me assign packages to the remaining ${totalUnmapped} rooms`)
        }
        className={cn(
          "w-full px-3 py-1.5 rounded-lg text-xs font-medium",
          "bg-orange-500/15 text-orange-300 border border-orange-500/25",
          "hover:bg-orange-500/25 active:scale-95 transition-all"
        )}
      >
        Help assign {totalUnmapped} remaining room{totalUnmapped !== 1 ? "s" : ""}
      </button>
    </div>
  );
}
