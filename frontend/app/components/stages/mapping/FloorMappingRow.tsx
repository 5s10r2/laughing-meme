"use client";

import { useState } from "react";
import { cn } from "../../../lib/cn";

interface UnitChip {
  id: string;
  name: string;
  packageId?: string;
  packageName?: string;
}

interface PackageOption {
  id: string;
  name: string;
  color?: string;
}

interface FloorMappingRowProps {
  floorLabel: string;
  floorIndex: number;
  units: UnitChip[];
  packages: PackageOption[];
  onSendMessage?: (text: string) => void;
}

const PACKAGE_COLORS = [
  "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
];

function getPackageColor(packageId: string, allPackages: PackageOption[]) {
  const idx = allPackages.findIndex((p) => p.id === packageId);
  return PACKAGE_COLORS[idx % PACKAGE_COLORS.length];
}

export function FloorMappingRow({
  floorLabel: rawFloorLabel,
  floorIndex,
  units: rawUnits,
  packages: rawPackages,
  onSendMessage,
  ...rest
}: FloorMappingRowProps & Record<string, unknown>) {
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  // Defensive: handle missing/malformed props from Claude
  const floorLabel = rawFloorLabel || (rest.floor_label as string) || (rest.floor as string) || `Floor ${floorIndex ?? 0}`;

  const units: UnitChip[] = Array.isArray(rawUnits)
    ? (rawUnits as unknown[]).map((raw: unknown, i: number) => {
        if (typeof raw === "string") return { id: String(i), name: raw };
        const u = raw as Record<string, unknown>;
        return {
          id: (u.id || String(i)) as string,
          name: (u.name || u.unit || String(u)) as string,
          packageId: (u.packageId || u.package_id) as string | undefined,
          packageName: (u.packageName || u.package_name) as string | undefined,
        };
      })
    : [];

  const packages: PackageOption[] = Array.isArray(rawPackages)
    ? (rawPackages as unknown[]).map((raw: unknown, i: number) => {
        if (typeof raw === "string") return { id: String(i), name: raw };
        const p = raw as Record<string, unknown>;
        return {
          id: (p.id || String(i)) as string,
          name: (p.name || p.package || String(p)) as string,
          color: p.color as string | undefined,
        };
      })
    : [];

  const mappedCount = units.filter((u) => u.packageId).length;
  const totalCount = units.length;

  function assignPackage(unitId: string, unitName: string, pkg: PackageOption) {
    setSelectedUnit(null);
    onSendMessage?.(
      `Assign ${unitName} on ${floorLabel} to ${pkg.name} package`
    );
  }

  return (
    <div className="border border-zinc-800 bg-zinc-900/30 rounded-xl px-3 py-3 my-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-300 font-medium">{floorLabel}</span>
        <span
          className={cn(
            "text-[10px] font-medium",
            mappedCount === totalCount ? "text-emerald-400" : "text-zinc-500"
          )}
        >
          {mappedCount}/{totalCount} mapped
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {units.map((unit) => (
          <div key={unit.id} className="relative">
            <button
              onClick={() =>
                setSelectedUnit(selectedUnit === unit.id ? null : unit.id)
              }
              className={cn(
                "px-2 py-1 rounded text-[10px] font-medium border transition-all",
                unit.packageId
                  ? getPackageColor(unit.packageId, packages)
                  : "bg-zinc-800/60 text-zinc-500 border-zinc-700 hover:border-zinc-600",
                selectedUnit === unit.id && "ring-1 ring-amber-400/50"
              )}
            >
              {unit.name}
            </button>

            {/* Package selector dropdown */}
            {selectedUnit === unit.id && (
              <div className="absolute top-full left-0 mt-1 z-10 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-1 min-w-[120px]">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => assignPackage(unit.id, unit.name, pkg)}
                    className="w-full text-left px-2 py-1.5 rounded text-[10px] text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    {pkg.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
