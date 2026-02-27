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
      <p className="text-[11px] text-zinc-500 mb-2 font-medium">Select your property type</p>
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
                "flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl",
                "border transition-all duration-200",
                "active:scale-95 cursor-pointer",
                isSelected
                  ? "border-amber-500 bg-amber-500/15 text-amber-200 ring-2 ring-amber-500/30"
                  : hasSelection
                    ? "border-zinc-800 bg-zinc-900/50 text-zinc-400 opacity-40 hover:opacity-70 hover:border-zinc-700"
                    : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/50"
              )}
            >
              <Icon className={cn("w-5 h-5", isSelected ? "text-amber-400" : "text-zinc-500")} />
              <span className="text-[10px] font-medium text-center leading-tight">
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
            className="text-[11px] text-zinc-500 hover:text-amber-400 transition-colors cursor-pointer"
          >
            change ↺
          </button>
        </div>
      )}
    </div>
  );
}
