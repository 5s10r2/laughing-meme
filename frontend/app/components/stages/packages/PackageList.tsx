"use client";

import { useState } from "react";
import { Package as PackageIcon, Snowflake, Fan } from "lucide-react";
import { cn } from "../../../lib/cn";
import type { Package } from "../../../lib/types";

interface PackageListProps {
  packages: Package[];
  onSendMessage?: (text: string) => void;
}

export function PackageList({ packages: rawPackages, onSendMessage, ...rest }: PackageListProps & Record<string, unknown>) {
  const [editingId, setEditingId] = useState<string | null>(null);

  // Defensive: handle missing/malformed packages from Claude
  const rawList = Array.isArray(rawPackages)
    ? rawPackages
    : Array.isArray((rest as Record<string, unknown>).items)
      ? ((rest as Record<string, unknown>).items as Package[])
      : [];

  const packages: Package[] = (rawList as unknown[]).map((raw: unknown, i: number) => {
    const p = raw as Record<string, unknown>;
    return {
      id: (p.id || String(i)) as string,
      name: (p.name || p.package_name || `Package ${i + 1}`) as string,
      category: (p.category || p.sharing_type || p.type || "") as string,
      sharing_type: p.sharing_type as string | undefined,
      furnishing: p.furnishing as string | undefined,
      amenities: Array.isArray(p.amenities) ? p.amenities : (p.ac ? ["AC"] : []),
      food_included: p.food_included as boolean | undefined,
      food_optional: p.food_optional as boolean | undefined,
      starting_rent: (p.starting_rent || p.rent || p.price || 0) as number,
      active: p.active !== undefined ? Boolean(p.active) : true,
      disabled: Boolean(p.disabled),
    };
  });

  if (!packages || packages.length === 0) return null;

  // Default to showing all packages if none are explicitly marked active
  const activePackages = packages.some((p) => p.active !== undefined && p.active === false)
    ? packages.filter((p) => p.active && !p.disabled)
    : packages.filter((p) => !p.disabled);

  return (
    <div className="border border-zinc-800 bg-zinc-900/30 rounded-xl px-3 py-3 my-2">
      <div className="flex items-center gap-2 mb-2.5">
        <PackageIcon className="w-3.5 h-3.5 text-amber-400/70" />
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
          Packages
        </span>
        <span className="text-[10px] text-zinc-600 ml-auto">
          {activePackages.length} active
        </span>
      </div>

      <div className="space-y-1">
        {activePackages.map((pkg) => {
          const isEditing = editingId === pkg.id;
          return (
            <div key={pkg.id}>
              <div
                className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-zinc-800/40 text-xs"
              >
                <div className="flex items-center gap-2">
                  {pkg.amenities?.includes("AC") ? (
                    <Snowflake className="w-3 h-3 text-blue-400" />
                  ) : (
                    <Fan className="w-3 h-3 text-zinc-500" />
                  )}
                  <span className="text-zinc-300 font-medium">{pkg.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  {pkg.starting_rent ? (
                    <span className="text-zinc-400 font-mono text-[11px]">
                      ₹{pkg.starting_rent.toLocaleString("en-IN")}
                    </span>
                  ) : null}
                  <button
                    onClick={() => setEditingId(isEditing ? null : pkg.id)}
                    className="text-[11px] text-zinc-500 hover:text-amber-400 underline-offset-2 hover:underline transition-colors cursor-pointer"
                  >
                    {isEditing ? "close" : "change"}
                  </button>
                </div>
              </div>

              {/* Inline edit panel */}
              {isEditing && (
                <InlinePackageEdit
                  pkg={pkg}
                  onSave={(msg) => {
                    setEditingId(null);
                    onSendMessage?.(msg);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Inline edit form for a package — pre-filled with current values */
function InlinePackageEdit({
  pkg,
  onSave,
  onCancel,
}: {
  pkg: Package;
  onSave: (message: string) => void;
  onCancel: () => void;
}) {
  const [rent, setRent] = useState(String(pkg.starting_rent || ""));
  const [ac, setAc] = useState(pkg.amenities?.includes("AC") ?? false);
  const [food, setFood] = useState(
    pkg.food_included ? "included" : pkg.food_optional ? "optional" : "not included"
  );
  const [furnishing, setFurnishing] = useState(pkg.furnishing || "furnished");

  function handleSave() {
    const rentNum = parseInt(rent, 10) || pkg.starting_rent || 0;
    const msg = `Update ${pkg.name}: rent ₹${rentNum.toLocaleString("en-IN")}, ${ac ? "AC" : "non-AC"}, food ${food}, ${furnishing}`;
    onSave(msg);
  }

  return (
    <div className="px-2.5 py-2.5 bg-zinc-800/30 rounded-b-lg border-x border-b border-zinc-800/50 space-y-2">
      {/* Rent */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-zinc-500 w-16">Rent</label>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-zinc-500">₹</span>
          <input
            type="number"
            value={rent}
            onChange={(e) => setRent(e.target.value)}
            className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none"
          />
        </div>
      </div>

      {/* AC toggle */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-zinc-500 w-16">AC</label>
        <button
          onClick={() => setAc(!ac)}
          className={cn(
            "px-2.5 py-0.5 rounded text-[10px] font-medium transition-all border",
            ac
              ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
              : "bg-zinc-800 text-zinc-500 border-zinc-700"
          )}
          role="switch"
          aria-checked={ac}
        >
          {ac ? "AC" : "Non-AC"}
        </button>
      </div>

      {/* Food */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-zinc-500 w-16">Food</label>
        <div className="flex gap-1">
          {["included", "optional", "not included"].map((opt) => (
            <button
              key={opt}
              onClick={() => setFood(opt)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium transition-all border",
                food === opt
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:border-zinc-600"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Furnishing */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-zinc-500 w-16">Furnishing</label>
        <div className="flex gap-1">
          {["furnished", "semi furnished", "unfurnished"].map((opt) => (
            <button
              key={opt}
              onClick={() => setFurnishing(opt)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium transition-all border capitalize",
                furnishing === opt
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:border-zinc-600"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-zinc-800/50">
        <button
          onClick={handleSave}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 active:scale-95 transition-all"
        >
          Save changes →
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 border border-zinc-700 hover:bg-zinc-800 active:scale-95 transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
