"use client";

import { useState } from "react";
import { cn } from "../../lib/cn";
import type { QuickReplyOption } from "../../lib/types";

interface QuickReplyChipsProps {
  options: QuickReplyOption[];
  onSendMessage?: (text: string) => void;
}

export function QuickReplyChips({ options, onSendMessage }: QuickReplyChipsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  if (!options || options.length === 0) return null;

  function handleSelect(option: QuickReplyOption) {
    setSelected(option.value);
    onSendMessage?.(option.value);
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map((option) => {
        const isSelected = selected === option.value;
        const hasSelection = !!selected;
        return (
          <button
            key={option.value}
            onClick={() => handleSelect(option)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
              "border active:scale-95 cursor-pointer",
              isSelected
                ? "bg-amber-500/20 border-amber-500 text-amber-100"
                : hasSelection
                  ? "border-amber-500/30 bg-zinc-900/60 text-amber-200/90 opacity-40 hover:opacity-70"
                  : "border-amber-500/30 hover:border-amber-500/60 bg-zinc-900/60 text-amber-200/90 hover:bg-amber-500/10"
            )}
          >
            {isSelected ? "✓ " : ""}{option.label}
          </button>
        );
      })}
    </div>
  );
}
