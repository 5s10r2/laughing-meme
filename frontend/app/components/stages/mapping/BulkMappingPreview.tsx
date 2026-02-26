"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "../../../lib/cn";

interface BulkOperation {
  floorLabel: string;
  unitCount: number;
  packageName: string;
}

interface BulkMappingPreviewProps {
  description: string;
  operations: BulkOperation[];
  totalUnits: number;
  totalFloors: number;
  onSendMessage?: (text: string) => void;
}

export function BulkMappingPreview({
  description: rawDescription,
  operations: rawOperations,
  totalUnits: rawTotalUnits,
  totalFloors: rawTotalFloors,
  onSendMessage,
  ...rest
}: BulkMappingPreviewProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed props from Claude
  // Claude may pass operations under various key names
  const rawList = Array.isArray(rawOperations)
    ? rawOperations
    : Array.isArray((rest as Record<string, unknown>).mappings)
      ? ((rest as Record<string, unknown>).mappings as BulkOperation[])
      : Array.isArray((rest as Record<string, unknown>).assignments)
        ? ((rest as Record<string, unknown>).assignments as BulkOperation[])
        : Array.isArray((rest as Record<string, unknown>).floors)
          ? ((rest as Record<string, unknown>).floors as BulkOperation[])
          : Array.isArray((rest as Record<string, unknown>).items)
            ? ((rest as Record<string, unknown>).items as BulkOperation[])
            : [];

  const operations: BulkOperation[] = (rawList as unknown[]).map((raw: unknown) => {
    const op = raw as Record<string, unknown>;
    return {
      floorLabel: (op.floorLabel || op.floor_label || op.floor || op.label || "Unknown Floor") as string,
      unitCount: (op.unitCount || op.unit_count || op.count || op.rooms || op.room_count || op.units || 0) as number,
      packageName: (op.packageName || op.package_name || op.package || "Unknown Package") as string,
    };
  });

  const description = rawDescription || (rest.description as string) || (rest.title as string) || "Bulk mapping operation";
  const totalUnits = rawTotalUnits
    || (rest.total_units as number)
    || (rest.total_rooms as number)
    || (rest.totalRooms as number)
    || (rest.room_count as number)
    || operations.reduce((sum, op) => sum + (op.unitCount || 0), 0)
    || 0;
  const totalFloors = rawTotalFloors
    || (rest.total_floors as number)
    || (rest.floor_count as number)
    || operations.length
    || 0;

  return (
    <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl px-4 py-3.5 my-2">
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs text-zinc-200 font-medium">{description}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {totalUnits} room{totalUnits !== 1 ? "s" : ""} across {totalFloors}{" "}
            floor{totalFloors !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="space-y-1 mb-3">
        {operations.map((op, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-800/40 text-xs"
          >
            <span className="text-zinc-400">{op.floorLabel}</span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 font-mono text-[11px]">
                {op.unitCount} room{op.unitCount !== 1 ? "s" : ""}
              </span>
              <span className="text-amber-300/80 font-medium text-[11px]">
                {op.packageName}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t border-amber-500/10">
        <button
          onClick={() => onSendMessage?.("Yes, confirm this mapping")}
          className={cn(
            "flex-1 px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-amber-500/20 text-amber-300 border border-amber-500/30",
            "hover:bg-amber-500/30 active:scale-95 transition-all"
          )}
        >
          Confirm
        </button>
        <button
          onClick={() => onSendMessage?.("No, I want to change this")}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 border border-zinc-700 hover:bg-zinc-800 active:scale-95 transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
