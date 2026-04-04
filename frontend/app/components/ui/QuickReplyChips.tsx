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
    <div className="flex gap-2 overflow-x-auto py-3 px-1">
      {options.map((option) => {
        const isSelected = selected === option.value;
        const hasSelection = !!selected;
        return (
          <button
            key={option.value}
            onClick={() => handleSelect(option)}
            disabled={hasSelection && !isSelected}
            className={cn(
              "flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap cursor-pointer",
              "border active:scale-[0.97]",
              isSelected
                ? "border-accent bg-accent text-white"
                : hasSelection
                  ? "border-border text-content-secondary opacity-40 pointer-events-none"
                  : "border-border text-content-secondary hover:bg-bg-elevated hover:border-border-strong"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
