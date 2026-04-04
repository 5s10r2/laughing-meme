"use client";

import { cn } from "../../../lib/cn";
import { CARD } from "../../ui/primitives";

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
    <div className={CARD}>
      <p className="text-xs font-medium text-content-tertiary mb-4">Mapping overview</p>

      <div className="space-y-3">
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

          // Calculate total mapped for bar proportions
          const totalSegments = segments.reduce((sum, s) => sum + s.count, 0) + unmapped;

          return (
            <div key={floor.index}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-content-secondary font-medium">
                  {floor.label}
                </span>
                <span className="text-[11px] text-content-tertiary">
                  {total} room{total !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Stacked horizontal bar */}
              <div className="flex gap-1 h-3 rounded-full overflow-hidden">
                {segments.map((seg) => (
                  <div
                    key={seg.packageName}
                    className="rounded-full bg-accent/30"
                    style={{ flex: seg.count }}
                    title={`${seg.packageName}: ${seg.count}`}
                  />
                ))}

                {/* Unmapped segment */}
                {unmapped > 0 && (
                  <div
                    className="rounded-full bg-warning/20 border border-dashed border-warning/30"
                    style={{ flex: unmapped }}
                    title={`Unmapped: ${unmapped}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
