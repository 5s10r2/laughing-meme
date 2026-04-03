"use client";

import { Grid3X3 } from "lucide-react";
import { cn } from "../../../lib/cn";

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

  // Find max room count across all floors for proportional bar width
  const maxRooms = Math.max(...sortedFloors.map((f) => floorTotals[f.index] || 0), 1);

  return (
    <div className="border border-border bg-bg-surface rounded-[var(--radius-card)] px-3 py-3 my-2">
      <div className="flex items-center gap-2 mb-3">
        <Grid3X3 className="w-3.5 h-3.5 text-accent-light" />
        <span className="text-xs font-medium text-content-secondary uppercase tracking-wider">
          Mapping Overview
        </span>
      </div>

      <div className="space-y-2.5">
        {sortedFloors.map((floor) => {
          const floorMapping = mapping[floor.index] || {};
          const total = floorTotals[floor.index] || 0;
          const unmapped = unmappedByFloor?.[floor.index] ?? 0;

          // Build segments for each package assigned to this floor
          const segments = packages
            .map((pkg) => ({
              packageName: pkg.name,
              count: floorMapping[pkg.id] || 0,
            }))
            .filter((s) => s.count > 0);

          return (
            <div key={floor.index} className="space-y-1">
              {/* Floor header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-content">
                  {floor.label}
                </span>
                <span className="text-xs text-content-tertiary">
                  {total} room{total !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Stacked bars */}
              <div className="space-y-1">
                {segments.map((seg) => (
                  <div key={seg.packageName} className="flex items-center gap-2">
                    <div
                      className="h-5 rounded bg-accent/10 flex items-center px-2 min-w-[40px]"
                      style={{ width: `${Math.max((seg.count / maxRooms) * 100, 20)}%` }}
                    >
                      <span className="text-xs text-accent-lighter font-medium truncate">
                        {seg.count}
                      </span>
                    </div>
                    <span className="text-xs text-content-secondary whitespace-nowrap">
                      {seg.packageName}
                    </span>
                  </div>
                ))}

                {/* Unmapped segment */}
                {unmapped > 0 && (
                  <div className="flex items-center gap-2">
                    <div
                      className="h-5 rounded bg-warning-surface border border-dashed border-warning/30 flex items-center px-2 min-w-[40px]"
                      style={{ width: `${Math.max((unmapped / maxRooms) * 100, 20)}%` }}
                    >
                      <span className="text-xs text-warning font-medium truncate">
                        {unmapped}
                      </span>
                    </div>
                    <span className="text-xs text-warning whitespace-nowrap">
                      unmapped
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
