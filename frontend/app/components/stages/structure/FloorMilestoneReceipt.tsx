"use client";

import { Check } from "lucide-react";

interface FloorMilestoneReceiptProps {
  floorLabel: string;
  unitCount: number;
  nameRange?: string;
  unitCategory?: string;
}

export function FloorMilestoneReceipt({
  floorLabel: rawFloorLabel,
  unitCount: rawUnitCount,
  nameRange,
  unitCategory,
  ...rest
}: FloorMilestoneReceiptProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed props from Claude
  const floorLabel = rawFloorLabel || (rest.floor_label as string) || (rest.floor as string) || (rest.label as string) || "Floor";
  const unitCount = rawUnitCount ?? (rest.unit_count as number) ?? (rest.rooms as number) ?? (rest.count as number) ?? 0;
  const range = nameRange || (rest.name_range as string) || (rest.range as string);
  const category = unitCategory || (rest.unit_category as string) || (rest.category as string);

  return (
    <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-emerald-950/15 border-l-2 border-emerald-500/30 my-1">
      <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
      <span className="text-xs text-emerald-300/80">
        {floorLabel}: {unitCount} room{unitCount !== 1 ? "s" : ""}
        {range && <span className="text-emerald-400/60"> ({range})</span>}
        {category && <span className="text-emerald-400/50">, {category}</span>}
      </span>
    </div>
  );
}
