"use client";

import { cn } from "../../../lib/cn";

interface FloorNaming {
  floor: string;
  names: string[];
}

interface NamingPreviewProps {
  pattern?: string;
  patternDescription?: string;
  preview: FloorNaming[];
  onSendMessage?: (text: string) => void;
}

export function NamingPreview({
  patternDescription: rawPatternDescription,
  preview: rawPreview,
  onSendMessage,
  ...rest
}: NamingPreviewProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed props from Claude
  const patternDescription = rawPatternDescription || (rest.pattern_description as string) || (rest.pattern as string) || "";

  const rawList = Array.isArray(rawPreview)
    ? rawPreview
    : Array.isArray((rest as Record<string, unknown>).floors)
      ? ((rest as Record<string, unknown>).floors as FloorNaming[])
      : Array.isArray((rest as Record<string, unknown>).names)
        ? ((rest as Record<string, unknown>).names as FloorNaming[])
        : [];

  const preview: FloorNaming[] = (rawList as unknown[]).map((raw: unknown, i: number) => {
    const f = raw as Record<string, unknown>;
    const floorLabel = (f.floor || f.floor_label || f.floorLabel || f.label || `Floor ${i}`) as string;
    const rawNames = Array.isArray(f.names) ? f.names
      : Array.isArray(f.room_names) ? f.room_names
      : Array.isArray(f.units) ? f.units
      : Array.isArray(f.rooms) ? f.rooms
      : [];
    return {
      floor: floorLabel,
      names: rawNames.map((n: unknown) => typeof n === "string" ? n : String(n)),
    };
  });

  if (!preview.length) return null;

  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-xl px-3.5 py-3 my-2">
      <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-1">
        Room Naming Preview
      </p>
      {patternDescription && (
        <p className="text-xs text-zinc-400 mb-2.5">{patternDescription}</p>
      )}

      <div className="space-y-2 mb-3">
        {preview.map((floor) => (
          <div key={floor.floor}>
            <p className="text-[10px] text-zinc-500 mb-1">{floor.floor}</p>
            <div className="flex flex-wrap gap-1">
              {(floor.names || []).map((name) => (
                <span
                  key={name}
                  className="px-2 py-0.5 rounded bg-zinc-800/80 text-[10px] text-zinc-300 font-mono"
                >
                  {name}
                </span>
              ))}
              {(floor.names || []).length >= 4 && (
                <span className="px-2 py-0.5 text-[10px] text-zinc-600">...</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t border-zinc-800">
        <button
          onClick={() => onSendMessage?.("Looks good")}
          className={cn(
            "flex-1 px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-amber-500/15 text-amber-300 border border-amber-500/25",
            "hover:bg-amber-500/25 active:scale-95 transition-all"
          )}
        >
          Looks good
        </button>
        <button
          onClick={() => onSendMessage?.("I use a different naming system")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium",
            "text-zinc-400 border border-zinc-700",
            "hover:bg-zinc-800 active:scale-95 transition-all"
          )}
        >
          Different pattern
        </button>
      </div>
    </div>
  );
}
