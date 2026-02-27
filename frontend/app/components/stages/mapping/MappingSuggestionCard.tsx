"use client";

import { Sparkles, ArrowRight } from "lucide-react";
import { cn } from "../../../lib/cn";

interface MappingSuggestion {
  floorLabel: string;
  floorIndex: number;
  packageName: string;
  unitCount: number;
}

interface MappingSuggestionCardProps {
  suggestions: MappingSuggestion[];
  onSendMessage?: (text: string) => void;
}

export function MappingSuggestionCard({
  suggestions: rawSuggestions,
  onSendMessage,
  ...rest
}: MappingSuggestionCardProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed suggestions from Claude
  const suggestions: MappingSuggestion[] = Array.isArray(rawSuggestions)
    ? (rawSuggestions as unknown[]).map((raw: unknown, i: number) => {
        const s = raw as Record<string, unknown>;
        return {
          floorLabel: (s.floorLabel || s.floor_label || s.floor || s.label || `Floor ${i}`) as string,
          floorIndex: (s.floorIndex ?? s.floor_index ?? i) as number,
          packageName: (s.packageName || s.package_name || s.package || "Unknown") as string,
          unitCount: (s.unitCount || s.unit_count || s.count || s.rooms || 0) as number,
        };
      })
    : [];

  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-xl px-4 py-3.5 my-2">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-semibold text-zinc-200">
          Suggested Mapping
        </span>
        <span className="text-[10px] text-zinc-600 ml-auto">
          {suggestions.length} floor{suggestions.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-1.5 mb-3">
        {suggestions.map((s) => (
          <div
            key={s.floorIndex}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-800"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-200 font-medium">
                {s.floorLabel}
              </p>
              <p className="text-[10px] text-zinc-500">
                {s.unitCount} room{s.unitCount !== 1 ? "s" : ""}
              </p>
            </div>
            <ArrowRight className="w-3 h-3 text-zinc-600 flex-shrink-0" />
            <span className="text-xs text-amber-300/80 font-medium flex-shrink-0">
              {s.packageName}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t border-zinc-800">
        <button
          onClick={() => {
            const summary = suggestions
              .map(
                (s) =>
                  `${s.floorLabel} → ${s.packageName} (${s.unitCount} room${s.unitCount !== 1 ? "s" : ""})`
              )
              .join(", ");
            onSendMessage?.(`Apply this mapping: ${summary}`);
          }}
          className={cn(
            "flex-1 px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-amber-500/15 text-amber-300 border border-amber-500/25",
            "hover:bg-amber-500/25 active:scale-95 transition-all"
          )}
        >
          Apply this mapping →
        </button>
        <button
          onClick={() =>
            onSendMessage?.("I want to map floors differently")
          }
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 border border-zinc-700 hover:bg-zinc-800 active:scale-95 transition-all"
        >
          I want to map differently
        </button>
      </div>
    </div>
  );
}
