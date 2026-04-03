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
                ? "bg-accent/10 border-accent text-accent-lighter"
                : hasSelection
                  ? "border-accent/30 bg-bg-surface text-accent-lighter opacity-40 pointer-events-none"
                  : "border-accent/30 hover:border-accent/60 bg-bg-surface text-accent-lighter hover:bg-accent/10"
            )}
          >
            {isSelected ? "✓ " : ""}{option.label}
          </button>
        );
      })}
    </div>
  );
}
