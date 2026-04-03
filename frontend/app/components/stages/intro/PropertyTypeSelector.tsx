"use client";

import { useState } from "react";
import { Building2, Home, BedDouble, Hotel, Users, Boxes } from "lucide-react";
import { cn } from "../../../lib/cn";

const PROPERTY_TYPES = [
  { id: "pg", label: "PG / Paying Guest", icon: BedDouble },
  { id: "hostel", label: "Hostel", icon: Hotel },
  { id: "flat", label: "Flat / Apartment", icon: Home },
  { id: "studio", label: "Studio", icon: Building2 },
  { id: "coliving", label: "Co-Living", icon: Users },
  { id: "mixed", label: "Mixed", icon: Boxes },
];

interface PropertyTypeSelectorProps {
  options?: Array<{ id: string; label: string; icon?: string }>;
  onSendMessage?: (text: string) => void;
}

export function PropertyTypeSelector({ options, onSendMessage }: PropertyTypeSelectorProps) {
  const [selected, setSelected] = useState<string | null>(null);

  // Use Claude-provided options if available, otherwise use hardcoded defaults
  const typeOptions = options && options.length > 0
    ? options.map((opt) => ({
        id: opt.id,
        label: opt.label,
        icon: PROPERTY_TYPES.find((pt) => pt.id === opt.id)?.icon || Building2,
      }))
    : PROPERTY_TYPES;

  function handleSelect(type: { id: string; label: string }) {
    setSelected(type.id);
    onSendMessage?.(type.id);
  }

  return (
    <div className="my-2">
      <p className="text-xs text-content-tertiary mb-1 font-medium">What type of property is this?</p>
      <p className="text-xs text-content-tertiary mb-2">This helps Tarini suggest the right packages for you</p>
      <div className="grid grid-cols-3 gap-2">
        {typeOptions.map((type) => {
          const Icon = type.icon;
          const isSelected = selected === type.id;
          const hasSelection = !!selected;
          return (
            <button
              key={type.id}
              onClick={() => handleSelect(type)}
              className={cn(
                "flex flex-col items-center gap-1.5 px-2 py-3 rounded-[var(--radius-card)]",
                "border transition-all duration-200",
                "active:scale-95 cursor-pointer",
                isSelected
                  ? "border-accent bg-accent/15 text-accent-lighter ring-2 ring-accent/30"
                  : hasSelection
                    ? "border-border bg-bg-surface text-content-secondary opacity-40 hover:opacity-70 hover:border-border"
                    : "border-border bg-bg-surface text-content-secondary hover:border-border hover:bg-bg-elevated"
              )}
            >
              <Icon className={cn("w-5 h-5", isSelected ? "text-accent-light" : "text-content-tertiary")} />
              <span className="text-xs font-medium text-center leading-tight">
                {type.label}
              </span>
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="flex justify-end mt-1.5">
          <button
            onClick={() => setSelected(null)}
            className="text-xs text-content-tertiary hover:text-accent-light transition-colors cursor-pointer px-2 py-1.5 -mr-2 -my-1.5 rounded"
          >
            change ↺
          </button>
        </div>
      )}
    </div>
  );
}
