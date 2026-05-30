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
  floorLabel = "Floor",
  unitCount = 0,
  nameRange,
  unitCategory,
}: FloorMilestoneReceiptProps) {
  return (
    <div className="flex items-center gap-2.5 py-2 px-3 rounded-xl bg-success/5 border border-success/12 my-1">
      <div className={cn(ICON_SM, "bg-success/12")}>
        <Check className="w-3 h-3 text-success" />
      </div>
      <p className="text-sm text-content">
        <span className="font-medium">{floorLabel}:</span>
        <span className="text-content-secondary ml-1">
          {unitCount} room{unitCount !== 1 ? "s" : ""}
          {nameRange && ` (${nameRange})`}
          {unitCategory && `, ${unitCategory}`}
        </span>
      </p>
    </div>
  );
}
