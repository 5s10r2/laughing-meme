"use client";

import { Grid3X3 } from "lucide-react";
import { cn } from "../../../lib/cn";

interface MappingCell {
  count: number;
  total: number;
}

interface MappingMatrixProps {
  floors: { index: number; label: string }[];
  packages: { id: string; name: string }[];
  /** mapping[floorIndex][packageId] = count */
  mapping: Record<number, Record<string, number>>;
  /** Total units per floor */
  floorTotals: Record<number, number>;
  unmappedByFloor?: Record<number, number>;
}

export function MappingMatrix({
  floors: rawFloors,
  packages: rawPackages,
  mapping: rawMapping,
  floorTotals: rawFloorTotals,
  unmappedByFloor,
  ...rest
}: MappingMatrixProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed props from Claude
  const floors = Array.isArray(rawFloors)
    ? (rawFloors as unknown[]).map((raw: unknown, i: number) => {
        if (typeof raw === "string") return { index: i, label: raw };
        const f = raw as Record<string, unknown>;
        return { index: (f.index ?? i) as number, label: (f.label || f.name || f.floor || `Floor ${i}`) as string };
      })
    : [];

  const packages = Array.isArray(rawPackages)
    ? (rawPackages as unknown[]).map((raw: unknown, i: number) => {
        if (typeof raw === "string") return { id: String(i), name: raw };
        const p = raw as Record<string, unknown>;
        return { id: (p.id || String(i)) as string, name: (p.name || p.package || String(p)) as string };
      })
    : [];

  const mapping = rawMapping && typeof rawMapping === "object" ? rawMapping : {};
  const floorTotals = rawFloorTotals && typeof rawFloorTotals === "object" ? rawFloorTotals : {};

  if (!floors.length || !packages.length) return null;

  // Sort floors top-to-bottom (highest first)
  const sortedFloors = [...floors].sort((a, b) => b.index - a.index);

  return (
    <div className="border border-zinc-800 bg-zinc-900/30 rounded-xl px-3 py-3 my-2">
      <div className="flex items-center gap-2 mb-3">
        <Grid3X3 className="w-3.5 h-3.5 text-amber-400/70" />
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
          Mapping Overview
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr>
              <th className="text-left text-zinc-500 font-medium pb-2 pr-3 whitespace-nowrap">
                Floor
              </th>
              {packages.map((pkg) => (
                <th
                  key={pkg.id}
                  className="text-center text-zinc-500 font-medium pb-2 px-2 whitespace-nowrap"
                >
                  {pkg.name}
                </th>
              ))}
              {unmappedByFloor && (
                <th className="text-center text-zinc-600 font-medium pb-2 px-2 whitespace-nowrap">
                  Unmapped
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedFloors.map((floor) => {
              const floorMapping = mapping[floor.index] || {};
              const total = floorTotals[floor.index] || 0;
              const unmapped = unmappedByFloor?.[floor.index] ?? 0;

              return (
                <tr key={floor.index} className="border-t border-zinc-800/50">
                  <td className="py-1.5 pr-3 text-zinc-300 font-medium whitespace-nowrap">
                    {floor.label}
                    <span className="text-zinc-600 ml-1">({total})</span>
                  </td>
                  {packages.map((pkg) => {
                    const count = floorMapping[pkg.id] || 0;
                    return (
                      <td key={pkg.id} className="py-1.5 px-2 text-center">
                        {count > 0 ? (
                          <span
                            className={cn(
                              "inline-block min-w-[20px] px-1.5 py-0.5 rounded",
                              "bg-amber-500/15 text-amber-300 font-medium"
                            )}
                          >
                            {count}
                          </span>
                        ) : (
                          <span className="text-zinc-700">&mdash;</span>
                        )}
                      </td>
                    );
                  })}
                  {unmappedByFloor && (
                    <td className="py-1.5 px-2 text-center">
                      {unmapped > 0 ? (
                        <span className="inline-block min-w-[20px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-medium">
                          {unmapped}
                        </span>
                      ) : (
                        <span className="text-emerald-500/60">&check;</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
