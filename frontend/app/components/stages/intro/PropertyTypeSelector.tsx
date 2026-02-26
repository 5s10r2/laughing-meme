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

export function PropertyTypeSelector({ onSendMessage }: PropertyTypeSelectorProps) {
  const [selected, setSelected] = useState<string | null>(null);

  function handleSelect(type: typeof PROPERTY_TYPES[number]) {
    if (selected) return;
    setSelected(type.id);
    onSendMessage?.(type.id);
  }

  return (
    <div className="my-2">
      <p className="text-[11px] text-zinc-500 mb-2 font-medium">Select your property type</p>
      <div className="grid grid-cols-3 gap-2">
        {PROPERTY_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = selected === type.id;
          return (
            <button
              key={type.id}
              onClick={() => handleSelect(type)}
              disabled={!!selected}
              className={cn(
                "flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl",
                "border transition-all duration-200",
                "disabled:cursor-not-allowed",
                isSelected
                  ? "border-amber-500 bg-amber-500/10 text-amber-200"
                  : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/50",
                !selected && "active:scale-95"
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
    </div>
  );
}
