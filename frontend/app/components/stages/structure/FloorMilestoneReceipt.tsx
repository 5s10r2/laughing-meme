"use client";

import { Check } from "lucide-react";
import { cn } from "../../../lib/cn";
import { ICON_SM } from "../../ui/primitives";

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
    <div className="flex items-center gap-2.5 py-2 px-3 rounded-xl bg-success/5 border border-success/12 my-1">
      <div className={cn(ICON_SM, "bg-success/12")}>
        <Check className="w-3 h-3 text-success" />
      </div>
      <p className="text-sm text-content">
        <span className="font-medium">{floorLabel}:</span>
        <span className="text-content-secondary ml-1">
          {unitCount} room{unitCount !== 1 ? "s" : ""}
          {range && ` (${range})`}
          {category && `, ${category}`}
        </span>
      </p>
    </div>
  );
}
