"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../../lib/cn";
import { humanizeCategory, getPackageColor } from "../../../lib/property-utils";
import { BottomSheet } from "../../ui/BottomSheet";
import { motion, AnimatePresence } from "framer-motion";

interface UnitChip {
  id: string;
  name: string;
  category?: string;
  sharingType?: string;
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

const COLLAPSE_THRESHOLD = 20;

export function FloorMappingRow({
  floorLabel: rawFloorLabel,
  floorIndex,
  units: rawUnits,
  packages: rawPackages,
  onSendMessage,
  ...rest
}: FloorMappingRowProps & Record<string, unknown>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Defensive: handle missing/malformed props from Claude
  const floorLabel = rawFloorLabel || (rest.floor_label as string) || (rest.floor as string) || `Floor ${floorIndex ?? 0}`;

  const units: UnitChip[] = Array.isArray(rawUnits)
    ? (rawUnits as unknown[]).map((raw: unknown, i: number) => {
        if (typeof raw === "string") return { id: String(i), name: raw };
        const u = raw as Record<string, unknown>;
        return {
          id: (u.id || String(i)) as string,
          name: (u.name || u.unit || String(u)) as string,
          category: (u.category || u.type || u.unit_type) as string | undefined,
          sharingType: (u.sharingType || u.sharing_type) as string | undefined,
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
  const hasUnmapped = mappedCount < totalCount;

  // Group units by category
  const hasCategories = units.some((u) => u.category);
  const categoryGroups: { category: string; label: string; units: UnitChip[] }[] = [];

  if (hasCategories) {
    const groupMap = new Map<string, UnitChip[]>();
    for (const u of units) {
      const cat = u.category || "other";
      if (!groupMap.has(cat)) groupMap.set(cat, []);
      groupMap.get(cat)!.push(u);
    }
    for (const [cat, catUnits] of groupMap) {
      categoryGroups.push({
        category: cat,
        label: humanizeCategory(cat),
        units: catUnits,
      });
    }
  }

  const shouldCollapse = totalCount > COLLAPSE_THRESHOLD;

  // ── Selection helpers ──
  const toggleUnit = useCallback((unitId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(units.map((u) => u.id)));
  }, [units]);

  const selectUnmapped = useCallback(() => {
    setSelected(new Set(units.filter((u) => !u.packageId).map((u) => u.id)));
  }, [units]);

  const selectCategory = useCallback((category: string) => {
    const catUnits = units.filter((u) => (u.category || "other") === category);
    setSelected(new Set(catUnits.map((u) => u.id)));
  }, [units]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  function assignSelected(pkg: PackageOption) {
    const selectedUnits = units.filter((u) => selected.has(u.id));
    if (selectedUnits.length === 0) return;
    const names = selectedUnits.map((u) => u.name).join(", ");
    onSendMessage?.(`Assign ${names} on ${floorLabel} to ${pkg.name}`);
    clearSelection();
  }

  // ── Chip rendering ──
  function renderUnitChips(unitList: UnitChip[]) {
    return (
      <div className="flex flex-wrap gap-1">
        {unitList.map((unit) => {
          const isSelected = selected.has(unit.id);
          return (
            <button
              key={unit.id}
              onClick={() => toggleUnit(unit.id)}
              className={cn(
                "px-2 py-1 rounded text-xs font-medium border transition-all",
                unit.packageId
                  ? getPackageColor(unit.packageId, packages)
                  : "bg-zinc-800/60 text-zinc-500 border-zinc-700 hover:border-zinc-500",
                !unit.packageId && !isSelected && "border-dashed",
                isSelected && "ring-2 ring-amber-400 bg-amber-500/10 border-amber-500/30"
              )}
            >
              {unit.name}
            </button>
          );
        })}
      </div>
    );
  }

  // Full room grid (used in BottomSheet)
  function renderFullGrid() {
    return (
      <>
        {/* Quick select buttons */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            onClick={selectAll}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium text-zinc-400 border border-zinc-700 hover:bg-zinc-800 transition-colors"
          >
            Select all
          </button>
          {hasUnmapped && (
            <button
              onClick={selectUnmapped}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium text-amber-400/80 border border-amber-500/25 hover:bg-amber-500/10 transition-colors"
            >
              Select unmapped
            </button>
          )}
          {hasCategories && categoryGroups.map((g) => (
            <button
              key={g.category}
              onClick={() => selectCategory(g.category)}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium text-zinc-400 border border-zinc-700 hover:bg-zinc-800 transition-colors"
            >
              All {g.label.toLowerCase()}
            </button>
          ))}
          {selected.size > 0 && (
            <button
              onClick={clearSelection}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium text-zinc-500 border border-zinc-700 hover:bg-zinc-800 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Grouped view */}
        {hasCategories && categoryGroups.length > 1 ? (
          <div className="space-y-3">
            {categoryGroups.map((group) => (
              <div key={group.category}>
                <p className="text-xs text-zinc-500 font-medium mb-1.5">
                  {group.label} ({group.units.length})
                </p>
                {renderUnitChips(group.units)}
              </div>
            ))}
          </div>
        ) : (
          renderUnitChips(units)
        )}

        {/* Bottom toolbar when units selected */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mt-3 pt-2 border-t border-zinc-700/50"
            >
              <p className="text-[11px] text-zinc-500 mb-1.5">
                Assign {selected.size} room{selected.size !== 1 ? "s" : ""} to:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => assignSelected(pkg)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      "hover:scale-[1.02] active:scale-95",
                      getPackageColor(pkg.id, packages)
                    )}
                  >
                    {pkg.name}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="border border-zinc-800 bg-zinc-900/30 rounded-xl px-3 py-3 my-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-300 font-medium">{floorLabel}</span>
        <span
          className={cn(
            "text-xs font-medium",
            mappedCount === totalCount ? "text-emerald-400" : "text-zinc-500"
          )}
        >
          {mappedCount}/{totalCount} mapped
        </span>
      </div>

      {/* Helper text */}
      {hasUnmapped && packages.length > 0 && (
        <p className="text-xs text-zinc-500 italic mb-2">
          Tap rooms to select, then assign a package
        </p>
      )}

      {/* ── Collapsed summary for 20+ units ── */}
      {shouldCollapse && !expanded && (
        <div className="mb-2">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-zinc-800/30 text-xs text-zinc-400">
            <span>
              {mappedCount === 0 ? `${totalCount} unmapped` : `${totalCount - mappedCount} unmapped / ${totalCount} total`}
              {hasCategories &&
                ` (${categoryGroups.map((g) => `${g.units.length} ${g.label.toLowerCase()}`).join(", ")})`}
            </span>
            <button
              onClick={() => setSheetOpen(true)}
              className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
            >
              <span>View all rooms</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Inline view for < COLLAPSE_THRESHOLD ── */}
      {!shouldCollapse && (
        <>
          {/* Quick select buttons */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button
              onClick={selectAll}
              className="px-2 py-0.5 rounded-full text-[11px] font-medium text-zinc-500 border border-zinc-700 hover:bg-zinc-800 transition-colors"
            >
              Select all
            </button>
            {hasUnmapped && (
              <button
                onClick={selectUnmapped}
                className="px-2 py-0.5 rounded-full text-[11px] font-medium text-amber-400/80 border border-amber-500/25 hover:bg-amber-500/10 transition-colors"
              >
                Unmapped
              </button>
            )}
            {hasCategories && categoryGroups.map((g) => (
              <button
                key={g.category}
                onClick={() => selectCategory(g.category)}
                className="px-2 py-0.5 rounded-full text-[11px] font-medium text-zinc-500 border border-zinc-700 hover:bg-zinc-800 transition-colors"
              >
                {g.label}
              </button>
            ))}
            {selected.size > 0 && (
              <button
                onClick={clearSelection}
                className="px-2 py-0.5 rounded-full text-[11px] font-medium text-zinc-600 border border-zinc-700 hover:bg-zinc-800 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Unit chips */}
          {hasCategories && categoryGroups.length > 1 ? (
            <div className="space-y-3">
              {categoryGroups.map((group) => (
                <div key={group.category}>
                  <p className="text-xs text-zinc-500 font-medium mb-1.5">
                    {group.label} ({group.units.length})
                  </p>
                  {renderUnitChips(group.units)}
                </div>
              ))}
            </div>
          ) : (
            renderUnitChips(units)
          )}

          {/* Floating toolbar when units selected */}
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="mt-2 pt-2 border-t border-zinc-700/50"
              >
                <p className="text-[11px] text-zinc-500 mb-1.5">
                  Assign {selected.size} room{selected.size !== 1 ? "s" : ""} to:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {packages.map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() => assignSelected(pkg)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                        "hover:scale-[1.02] active:scale-95",
                        getPackageColor(pkg.id, packages)
                      )}
                    >
                      {pkg.name}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── BottomSheet for large floors ── */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={`${floorLabel} — All Rooms`}
      >
        {renderFullGrid()}
      </BottomSheet>
    </div>
  );
}
