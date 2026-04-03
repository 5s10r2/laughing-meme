"use client";

import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { cn } from "../../../lib/cn";

interface PackageFormProps {
  name?: string;
  prefill?: {
    ac?: boolean;
    food?: "included" | "optional" | "none";
    furnishing?: "fully_furnished" | "semi_furnished" | "unfurnished";
    rent?: number;
    sharingType?: string;
    category?: string;
  };
  onSendMessage?: (text: string) => void;
}

interface CreatedPackage {
  name: string;
  sharingType: string;
  ac: boolean;
  food: string;
  furnishing: string;
  rent: string;
}

const SHARING_OPTIONS = [
  { value: "private", label: "Private" },
  { value: "double", label: "Double" },
  { value: "triple", label: "Triple" },
  { value: "dormitory", label: "Dorm" },
] as const;

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

/** Advance to next sharing type for smart defaults */
function nextSharingType(current: string): string {
  const order = ["private", "double", "triple", "dormitory"];
  const idx = order.indexOf(current);
  return order[Math.min(idx + 1, order.length - 1)] || "private";
}

export function PackageForm({ name: rawName, prefill: rawPrefill, onSendMessage, ...rest }: PackageFormProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed props from Claude
  const name = rawName || (rest.package_name as string) || (rest.packageName as string) || "";
  const prefill = rawPrefill || (rest.defaults as typeof rawPrefill) || {};

  const [packageName, setPackageName] = useState(name || "");
  const [sharingType, setSharingType] = useState<string>(
    prefill?.sharingType || (rest.sharing_type as string) || (rest.sharingType as string) || "private"
  );
  const [ac, setAc] = useState(prefill?.ac ?? (rest.ac as boolean) ?? false);
  const [food, setFood] = useState<"included" | "optional" | "none">(prefill?.food ?? (rest.food as "included" | "optional" | "none") ?? "none");
  const [furnishing, setFurnishing] = useState<"fully_furnished" | "semi_furnished" | "unfurnished">(
    prefill?.furnishing ?? (rest.furnishing as "fully_furnished" | "semi_furnished" | "unfurnished") ?? "semi_furnished"
  );
  const [rent, setRent] = useState(prefill?.rent?.toString() || (rest.rent as number)?.toString() || (rest.starting_rent as number)?.toString() || "");

  // Multi-create session tracking
  const [createdPackages, setCreatedPackages] = useState<CreatedPackage[]>([]);
  const [done, setDone] = useState(false);

  function handleSubmit() {
    if (!packageName.trim() || !rent.trim()) return;

    const sharingLabel = SHARING_OPTIONS.find((o) => o.value === sharingType)?.label || sharingType;
    const foodLabel = food === "included" ? "food included" : food === "optional" ? "food optional" : "no food";
    const furnishLabel = furnishing.replace(/_/g, " ");

    // Add to session list
    setCreatedPackages((prev) => [
      ...prev,
      { name: packageName.trim(), sharingType, ac, food: foodLabel, furnishing: furnishLabel, rent },
    ]);

    // Send message for this package
    const message = `Package: ${packageName.trim()}, ${sharingLabel} sharing, ${ac ? "AC" : "non-AC"}, ${foodLabel}, ${furnishLabel}, rent ₹${rent}`;
    onSendMessage?.(message);

    // Reset form with smart defaults for next package
    setPackageName("");
    setSharingType(nextSharingType(sharingType));
    // Keep AC and food — likely same across packages
    setRent("");
  }

  function handleDone() {
    setDone(true);
    if (createdPackages.length > 1) {
      onSendMessage?.(`Done adding packages — created ${createdPackages.length} packages total`);
    }
  }

  return (
    <div className="border border-border border-l-2 border-l-accent/30 bg-bg-surface rounded-[var(--radius-card)] px-4 py-3.5 my-2">
      <p className="text-xs text-content-tertiary font-medium uppercase tracking-wider mb-3">
        {name ? `Edit: ${name}` : "New Package"}
      </p>

      {/* ── Created packages this session ── */}
      {createdPackages.length > 0 && (
        <div className="mb-3 pb-2 border-b border-border">
          <p className="text-[11px] text-content-tertiary mb-1.5">
            Created ({createdPackages.length}):
          </p>
          <div className="flex flex-wrap gap-1">
            {createdPackages.map((pkg, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-surface border border-success-surface text-[11px] text-success font-medium"
              >
                <Check className="w-2.5 h-2.5" />
                {pkg.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Form (hidden when done) ── */}
      {!done && (
        <>
          <div className="space-y-3">
            {/* Package name */}
            <div>
              <label className="text-xs text-content-tertiary mb-1 block">Package Name</label>
              <input
                type="text"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="e.g. AC Double Sharing"
                className="w-full px-3 py-1.5 rounded-[var(--radius-button)] bg-bg-elevated border border-border text-xs text-content placeholder-content-tertiary focus:outline-none focus:border-accent/50"
              />
            </div>

            {/* Sharing Type */}
            <div>
              <label className="text-xs text-content-tertiary mb-1.5 block">Room Type</label>
              <div className="flex gap-1">
                {SHARING_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSharingType(opt.value)}
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded-[var(--radius-button)] text-xs font-medium transition-all",
                      "border",
                      sharingType === opt.value
                        ? "border-accent/40 bg-accent/10 text-accent-lighter"
                        : "border-border bg-bg-elevated text-content-tertiary hover:bg-bg-elevated"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AC Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-xs text-content-secondary">Air Conditioning</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-content-tertiary font-medium">{ac ? "AC" : "Non-AC"}</span>
                <button
                  onClick={() => setAc(!ac)}
                  role="switch"
                  aria-checked={ac}
                  className={cn(
                    "w-10 h-5 rounded-full transition-all duration-200 relative",
                    ac ? "bg-accent" : "bg-bg-subtle"
                  )}
                >
                  <div
                    className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all duration-200"
                    style={{ left: ac ? "22px" : "2px" }}
                  />
                </button>
              </div>
            </div>

            {/* Food */}
            <div>
              <label className="text-xs text-content-tertiary mb-1.5 block">Food</label>
              <div className="flex gap-1">
                {FOOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFood(opt.value)}
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded-[var(--radius-button)] text-xs font-medium transition-all",
                      "border",
                      food === opt.value
                        ? "border-accent/40 bg-accent/10 text-accent-lighter"
                        : "border-border bg-bg-elevated text-content-tertiary hover:bg-bg-elevated"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Furnishing */}
            <div>
              <label className="text-xs text-content-tertiary mb-1.5 block">Furnishing</label>
              <div className="flex gap-1">
                {FURNISHING_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFurnishing(opt.value)}
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded-[var(--radius-button)] text-xs font-medium transition-all",
                      "border",
                      furnishing === opt.value
                        ? "border-accent/40 bg-accent/10 text-accent-lighter"
                        : "border-border bg-bg-elevated text-content-tertiary hover:bg-bg-elevated"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rent */}
            <div>
              <label className="text-xs text-content-tertiary mb-1 block">Starting Rent</label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-content-tertiary font-medium">₹</span>
                <input
                  type="number"
                  value={rent}
                  onChange={(e) => setRent(e.target.value)}
                  placeholder="8000"
                  className="flex-1 px-3 py-1.5 rounded-[var(--radius-button)] bg-bg-elevated border border-border text-xs text-content placeholder-content-tertiary focus:outline-none focus:border-accent/50"
                />
                <span className="text-xs text-content-tertiary">/month</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSubmit}
              disabled={!packageName.trim() || !rent.trim()}
              className={cn(
                "flex-1 px-3 py-2.5 rounded-[var(--radius-button)] text-[13px] font-semibold transition-all",
                "bg-accent/10 text-accent-lighter border border-accent/30",
                "hover:bg-accent/15 active:scale-[0.98]",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {createdPackages.length > 0 ? (
                <span className="flex items-center justify-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  Save &amp; add another
                </span>
              ) : (
                `Save ${packageName.trim() || "package"} →`
              )}
            </button>

            {createdPackages.length > 0 && (
              <button
                onClick={handleDone}
                className={cn(
                  "px-3 py-1.5 rounded-[var(--radius-button)] text-xs font-medium",
                  "text-success border border-success-surface",
                  "hover:bg-success-surface active:scale-95 transition-all"
                )}
              >
                Done adding
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Done state ── */}
      {done && (
        <p className="text-xs text-success font-medium">
          {createdPackages.length} package{createdPackages.length !== 1 ? "s" : ""} created
        </p>
      )}
    </div>
  );
}
