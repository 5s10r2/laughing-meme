"use client";

import { useState } from "react";
import { cn } from "../../../lib/cn";

interface PackageFormProps {
  name?: string;
  prefill?: {
    ac?: boolean;
    food?: "included" | "optional" | "none";
    furnishing?: "fully_furnished" | "semi_furnished" | "unfurnished";
    rent?: number;
  };
  onSendMessage?: (text: string) => void;
}

export function PackageForm({ name: rawName, prefill: rawPrefill, onSendMessage, ...rest }: PackageFormProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed props from Claude
  const name = rawName || (rest.package_name as string) || (rest.packageName as string) || "";
  const prefill = rawPrefill || (rest.defaults as typeof rawPrefill) || {};

  const [packageName, setPackageName] = useState(name || "");
  const [ac, setAc] = useState(prefill?.ac ?? (rest.ac as boolean) ?? false);
  const [food, setFood] = useState<"included" | "optional" | "none">(prefill?.food ?? (rest.food as "included" | "optional" | "none") ?? "none");
  const [furnishing, setFurnishing] = useState<"fully_furnished" | "semi_furnished" | "unfurnished">(
    prefill?.furnishing ?? (rest.furnishing as "fully_furnished" | "semi_furnished" | "unfurnished") ?? "semi_furnished"
  );
  const [rent, setRent] = useState(prefill?.rent?.toString() || (rest.rent as number)?.toString() || (rest.starting_rent as number)?.toString() || "");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (submitted || !packageName.trim() || !rent.trim()) return;
    setSubmitted(true);

    const foodLabel = food === "included" ? "food included" : food === "optional" ? "food optional" : "no food";
    const furnishLabel = furnishing.replace(/_/g, " ");
    const message = `Package: ${packageName.trim()}, AC: ${ac ? "yes" : "no"}, Food: ${foodLabel}, Furnishing: ${furnishLabel}, Rent: ${rent}`;
    onSendMessage?.(message);
  }

  const FOOD_OPTIONS = [
    { value: "included" as const, label: "Included" },
    { value: "optional" as const, label: "Optional" },
    { value: "none" as const, label: "No food" },
  ];

  const FURNISHING_OPTIONS = [
    { value: "fully_furnished" as const, label: "Fully" },
    { value: "semi_furnished" as const, label: "Semi" },
    { value: "unfurnished" as const, label: "Unfurn." },
  ];

  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-xl px-4 py-3.5 my-2">
      <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-3">
        {name ? `Edit: ${name}` : "New Package"}
      </p>

      <div className="space-y-3">
        {/* Package name */}
        <div>
          <label className="text-[11px] text-zinc-500 mb-1 block">Package Name</label>
          <input
            type="text"
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            disabled={submitted}
            placeholder="e.g. AC Double Sharing"
            className="w-full px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 disabled:opacity-40"
          />
        </div>

        {/* AC Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-400">Air Conditioning</label>
          <button
            onClick={() => !submitted && setAc(!ac)}
            disabled={submitted}
            className={cn(
              "w-10 h-5 rounded-full transition-all duration-200 relative",
              ac ? "bg-amber-500" : "bg-zinc-700",
              "disabled:opacity-40"
            )}
          >
            <div
              className={cn(
                "w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all duration-200",
                ac ? "left-5.5" : "left-0.5"
              )}
              style={{ left: ac ? "22px" : "2px" }}
            />
          </button>
        </div>

        {/* Food */}
        <div>
          <label className="text-[11px] text-zinc-500 mb-1.5 block">Food</label>
          <div className="flex gap-1">
            {FOOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => !submitted && setFood(opt.value)}
                disabled={submitted}
                className={cn(
                  "flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                  "border",
                  food === opt.value
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-zinc-700 bg-zinc-800/40 text-zinc-500 hover:bg-zinc-800",
                  "disabled:opacity-40"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Furnishing */}
        <div>
          <label className="text-[11px] text-zinc-500 mb-1.5 block">Furnishing</label>
          <div className="flex gap-1">
            {FURNISHING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => !submitted && setFurnishing(opt.value)}
                disabled={submitted}
                className={cn(
                  "flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                  "border",
                  furnishing === opt.value
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-zinc-700 bg-zinc-800/40 text-zinc-500 hover:bg-zinc-800",
                  "disabled:opacity-40"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rent */}
        <div>
          <label className="text-[11px] text-zinc-500 mb-1 block">Starting Rent</label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-500 font-medium">Rs.</span>
            <input
              type="number"
              value={rent}
              onChange={(e) => setRent(e.target.value)}
              disabled={submitted}
              placeholder="8000"
              className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 disabled:opacity-40"
            />
            <span className="text-[10px] text-zinc-600">/month</span>
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitted || !packageName.trim() || !rent.trim()}
        className={cn(
          "w-full mt-3 px-3 py-2 rounded-lg text-xs font-medium transition-all",
          "bg-amber-500/20 text-amber-300 border border-amber-500/30",
          "hover:bg-amber-500/30 active:scale-[0.98]",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        {submitted ? "Submitted" : "Save Package"}
      </button>
    </div>
  );
}
