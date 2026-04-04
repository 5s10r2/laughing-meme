"use client";

import { useState } from "react";
import { Building2, Home, BedDouble, Hotel, Users, Boxes } from "lucide-react";
import { cn } from "../../../lib/cn";
import { CARD } from "../../ui/primitives";

const PROPERTY_TYPES = [
  { id: "pg", label: "PG", sub: "Paying Guest", icon: BedDouble },
  { id: "hostel", label: "Hostel", sub: "Dormitory", icon: Hotel },
  { id: "flat", label: "Flat", sub: "Apartment", icon: Home },
  { id: "studio", label: "Studio", sub: "Single unit", icon: Building2 },
  { id: "coliving", label: "Co-Living", sub: "Shared", icon: Users },
  { id: "mixed", label: "Mixed", sub: "Multiple", icon: Boxes },
];

interface PropertyTypeSelectorProps {
  options?: Array<{ id: string; label: string; icon?: string }>;
  onSendMessage?: (text: string) => void;
}

export function PropertyTypeSelector({ options, onSendMessage }: PropertyTypeSelectorProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const typeOptions = options && options.length > 0
    ? options.map((opt) => ({
        id: opt.id,
        label: PROPERTY_TYPES.find((pt) => pt.id === opt.id)?.label || opt.label,
        sub: PROPERTY_TYPES.find((pt) => pt.id === opt.id)?.sub || "",
        icon: PROPERTY_TYPES.find((pt) => pt.id === opt.id)?.icon || Building2,
      }))
    : PROPERTY_TYPES;

  function handleSelect(type: { id: string; label: string }) {
    setSelected(type.id);
    onSendMessage?.(type.id);
  }

  return (
    <div className={cn(CARD, "my-2")}>
      <p className="text-xs font-medium text-content-tertiary mb-1">Select property type</p>
      <p className="text-[11px] text-content-tertiary/70 mb-4">This helps Tarini suggest the right setup</p>
      <div className="grid grid-cols-3 gap-2.5">
        {typeOptions.map((type) => {
          const Icon = type.icon;
          const isSelected = selected === type.id;
          const hasSelection = !!selected;
          return (
            <button
              key={type.id}
              onClick={() => handleSelect(type)}
              className={cn(
                "flex flex-col items-center gap-2 py-4 px-3 rounded-xl transition-all",
                "border cursor-pointer active:scale-[0.97]",
                isSelected
                  ? "border-accent bg-accent/8 ring-1 ring-accent/20"
                  : hasSelection
                    ? "border-border bg-bg-elevated opacity-40"
                    : "border-border bg-bg-elevated hover:bg-bg-subtle hover:border-border-strong"
              )}
            >
              <Icon className={cn("w-5 h-5", isSelected ? "text-accent-lighter" : "text-content-tertiary")} />
              <div className="text-center">
                <span className={cn("text-sm font-medium block", isSelected ? "text-content" : "text-content-secondary")}>{type.label}</span>
                <span className="text-[10px] text-content-tertiary">{type.sub}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
