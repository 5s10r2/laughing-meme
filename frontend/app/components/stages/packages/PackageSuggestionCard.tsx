"use client";

import { Sparkles, Snowflake, Fan } from "lucide-react";
import { cn } from "../../../lib/cn";

interface SuggestedPackage {
  name: string;
  sharingType?: string;
  ac: boolean;
  estimatedRent?: string;
}

interface PackageSuggestionCardProps {
  suggestions: SuggestedPackage[];
  location?: string;
  onSendMessage?: (text: string) => void;
}

export function PackageSuggestionCard({
  suggestions: rawSuggestions,
  location,
  onSendMessage,
  ...rest
}: PackageSuggestionCardProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed suggestions from Claude
  const suggestions: SuggestedPackage[] = Array.isArray(rawSuggestions)
    ? rawSuggestions
    : rawSuggestions && typeof rawSuggestions === "object"
      ? Object.values(rawSuggestions as Record<string, unknown>).map((v) => {
          if (typeof v === "object" && v !== null) return v as SuggestedPackage;
          return { name: String(v), ac: false };
        })
      : [];

  // Also try to extract suggestions from other common prop names Claude might use
  const finalSuggestions = suggestions.length > 0
    ? suggestions
    : Array.isArray((rest as Record<string, unknown>).packages)
      ? ((rest as Record<string, unknown>).packages as SuggestedPackage[])
      : [];

  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-xl px-4 py-3.5 my-2">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-semibold text-zinc-200">Suggested Packages</span>
        {location && (
          <span className="text-[10px] text-zinc-600 ml-auto">Based on {location}</span>
        )}
      </div>

      <div className="space-y-1.5 mb-3">
        {finalSuggestions.map((pkg, idx) => (
          <div
            key={pkg.name || idx}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-800"
          >
            <div className="flex items-center gap-2">
              {pkg.ac ? (
                <Snowflake className="w-3 h-3 text-blue-400" />
              ) : (
                <Fan className="w-3 h-3 text-zinc-500" />
              )}
              <div>
                <p className="text-xs text-zinc-200 font-medium">{pkg.name}</p>
                {pkg.sharingType && (
                  <p className="text-[10px] text-zinc-500">{pkg.sharingType}</p>
                )}
              </div>
            </div>
            {pkg.estimatedRent && (
              <span className="text-xs text-zinc-400 font-mono">{pkg.estimatedRent}</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t border-zinc-800">
        <button
          onClick={() => onSendMessage?.("These suggestions look good, let's use them")}
          className={cn(
            "flex-1 px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-amber-500/15 text-amber-300 border border-amber-500/25",
            "hover:bg-amber-500/25 active:scale-95 transition-all"
          )}
        >
          Use these
        </button>
        <button
          onClick={() => onSendMessage?.("I have different packages in mind")}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 border border-zinc-700 hover:bg-zinc-800 active:scale-95 transition-all"
        >
          Customize
        </button>
      </div>
    </div>
  );
}
