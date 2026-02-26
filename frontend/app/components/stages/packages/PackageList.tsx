"use client";

import { Package as PackageIcon, Snowflake, Fan } from "lucide-react";
import type { Package } from "../../../lib/types";

interface PackageListProps {
  packages: Package[];
  onSendMessage?: (text: string) => void;
}

export function PackageList({ packages: rawPackages, onSendMessage, ...rest }: PackageListProps & Record<string, unknown>) {
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
        {activePackages.map((pkg) => (
          <div
            key={pkg.id}
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
              {pkg.starting_rent && (
                <span className="text-zinc-400 font-mono text-[11px]">
                  Rs.{pkg.starting_rent.toLocaleString("en-IN")}
                </span>
              )}
              <button
                onClick={() => onSendMessage?.(`Edit ${pkg.name} package`)}
                className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
