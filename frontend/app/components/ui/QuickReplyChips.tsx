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
    if (selected) return; // already selected
    setSelected(option.value);
    onSendMessage?.(option.value);
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => handleSelect(option)}
          disabled={!!selected}
          className={cn(
            "px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
            "border border-amber-500/30 hover:border-amber-500/60",
            "bg-zinc-900/60 text-amber-200/90 hover:bg-amber-500/10",
            "active:scale-95",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            selected === option.value &&
              "bg-amber-500/20 border-amber-500 text-amber-100"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
