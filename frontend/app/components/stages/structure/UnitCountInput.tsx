"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "../../../lib/cn";

interface UnitCountInputProps {
  floorLabel: string;
  currentCount?: number;
  suggestedRange?: [number, number];
  hint?: string;
  onSendMessage?: (text: string) => void;
}

export function UnitCountInput({
  floorLabel: rawFloorLabel,
  currentCount = 4,
  suggestedRange,
  hint,
  onSendMessage,
  ...rest
}: UnitCountInputProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed props from Claude
  const floorLabel = rawFloorLabel || (rest.floor_label as string) || (rest.floor as string) || (rest.label as string) || "Floor";
  const [count, setCount] = useState(currentCount);
  const [submitted, setSubmitted] = useState(false);

  const min = suggestedRange?.[0] ?? 1;
  const max = suggestedRange?.[1] ?? 50;

  function handleSubmit() {
    if (submitted) return;
    setSubmitted(true);
    onSendMessage?.(`${count} rooms on ${floorLabel}`);
  }

  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-xl px-3.5 py-3 my-2">
      <p className="text-xs text-zinc-300 font-medium mb-2.5">{floorLabel}</p>

      <div className="flex items-center gap-3">
        {/* Stepper */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCount(Math.max(min, count - 1))}
            disabled={count <= min || submitted}
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center",
              "border border-zinc-700 bg-zinc-800 text-zinc-400",
              "hover:bg-zinc-700 active:scale-95 transition-all",
              "disabled:opacity-30 disabled:cursor-not-allowed"
            )}
          >
            <Minus className="w-3 h-3" />
          </button>

          <div className="w-10 text-center">
            <span className="text-lg font-bold text-zinc-100">{count}</span>
          </div>

          <button
            onClick={() => setCount(Math.min(max, count + 1))}
            disabled={count >= max || submitted}
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center",
              "border border-zinc-700 bg-zinc-800 text-zinc-400",
              "hover:bg-zinc-700 active:scale-95 transition-all",
              "disabled:opacity-30 disabled:cursor-not-allowed"
            )}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <span className="text-xs text-zinc-500">rooms</span>

        {/* Confirm */}
        <button
          onClick={handleSubmit}
          disabled={submitted}
          className={cn(
            "ml-auto px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-amber-500/15 text-amber-300 border border-amber-500/25",
            "hover:bg-amber-500/25 active:scale-95 transition-all",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {submitted ? "Sent" : "Confirm"}
        </button>
      </div>

      {hint && (
        <p className="text-[10px] text-zinc-600 mt-2">{hint}</p>
      )}
    </div>
  );
}
