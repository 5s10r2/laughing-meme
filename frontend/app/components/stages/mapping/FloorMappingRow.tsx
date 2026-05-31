"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "../../../lib/cn";
import { humanizeCategory, getPackageColor } from "../../../lib/property-utils";
import { BottomSheet } from "../../ui/BottomSheet";
import { CARD } from "../../ui/primitives";
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

function normalizeUnits(rawUnits: UnitChip[]): UnitChip[] {
  if (!Array.isArray(rawUnits)) return [];
  return (rawUnits as unknown[]).map((raw: unknown, i: number) => {
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
  });
}

function normalizePackages(rawPackages: PackageOption[]): PackageOption[] {
  if (!Array.isArray(rawPackages)) return [];
  return (rawPackages as unknown[]).map((raw: unknown, i: number) => {
    if (typeof raw === "string") return { id: String(i), name: raw };
    const p = raw as Record<string, unknown>;
    return {
      id: (p.id || String(i)) as string,
      name: (p.name || p.package || String(p)) as string,
      color: p.color as string | undefined,
    };
  });
}

export function FloorMappingRow({
  floorLabel,
  floorIndex,
  units: rawUnits,
  packages: rawPackages,
  onSendMessage,
}: FloorMappingRowProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);

  const label = floorLabel || `Floor ${floorIndex ?? 0}`;

  const units = useMemo(() => normalizeUnits(rawUnits), [rawUnits]);
  const packages = useMemo(() => normalizePackages(rawPackages), [rawPackages]);

  const mappedCount = units.filter((u) => u.packageId).length;
  const totalCount = units.length;
  const hasUnmapped = mappedCount < totalCount;

  // Group units by category
  const categoryGroups = useMemo(() => {
    const groupMap = new Map<string, UnitChip[]>();
    for (const u of units) {
      const cat = u.category || "other";
      if (!groupMap.has(cat)) groupMap.set(cat, []);
      groupMap.get(cat)!.push(u);
    }
    const groups: { category: string; label: string; units: UnitChip[] }[] = [];
    for (const [cat, catUnits] of groupMap) {
      groups.push({
        category: cat,
        label: humanizeCategory(cat),
        units: catUnits,
      });
    }
    return groups;
  }, [units]);

  const hasCategories = units.some((u) => u.category);

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
    onSendMessage?.(`Assign ${names} on ${label} to ${pkg.name}`);
    clearSelection();
  }

  // ── Chip rendering ──
  function renderUnitChips(unitList: UnitChip[]) {
    return (
      <div className="flex flex-wrap gap-2">
        {unitList.map((unit) => {
          const isSelected = selected.has(unit.id);
          return (
            <button
              key={unit.id}
              onClick={() => toggleUnit(unit.id)}
              className={cn(
                "px-3.5 py-2.5 rounded-lg text-sm font-mono font-medium transition-all cursor-pointer border",
                isSelected
                  ? "border-accent bg-accent/10 text-accent-lighter ring-1 ring-accent/20"
                  : unit.packageId
                    ? getPackageColor(unit.packageId, packages)
                    : "border-border border-dashed bg-bg-elevated text-content-tertiary hover:bg-bg-subtle"
              )}
            >
              {unit.name}
            </button>
          );
        })}
      </div>
    );
  }

  // Shared package picker shown when units are selected (inline + BottomSheet).
  function renderPackagePicker(className: string) {
    return (
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={className}
          >
            <p className="text-[11px] text-content-tertiary mb-1.5">
              Assign {selected.size} room{selected.size !== 1 ? "s" : ""} to:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => assignSelected(pkg)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer",
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
            className="px-2.5 py-1 rounded-full text-[11px] font-medium text-content-secondary border border-border hover:bg-bg-elevated transition-colors cursor-pointer"
          >
            Select all
          </button>
          {hasUnmapped && (
            <button
              onClick={selectUnmapped}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium text-accent-light border border-accent/30 hover:bg-accent/10 transition-colors cursor-pointer"
            >
              Select unmapped
            </button>
          )}
          {hasCategories && categoryGroups.map((g) => (
            <button
              key={g.category}
              onClick={() => selectCategory(g.category)}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium text-content-secondary border border-border hover:bg-bg-elevated transition-colors cursor-pointer"
            >
              All {g.label.toLowerCase()}
            </button>
          ))}
          {selected.size > 0 && (
            <button
              onClick={clearSelection}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium text-content-tertiary border border-border hover:bg-bg-elevated transition-colors cursor-pointer"
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
                <p className="text-xs text-content-tertiary font-medium mb-1.5">
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
        {renderPackagePicker("mt-3 pt-2 border-t border-border/50")}
      </>
    );
  }

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-content font-semibold">{label}</p>
          <p className="text-[11px] text-content-tertiary mt-0.5">
            {selected.size}/{totalCount} selected
          </p>
        </div>
        <button
          onClick={selectAll}
          className="text-xs text-accent-lighter hover:underline cursor-pointer"
        >
          Select all
        </button>
      </div>

      {/* Helper text */}
      {hasUnmapped && packages.length > 0 && !shouldCollapse && (
        <p className="text-[11px] text-content-tertiary/70 mb-4">
          Tap rooms to select, then assign a package
        </p>
      )}

      {/* ── Collapsed summary for 20+ units ── */}
      {shouldCollapse && (
        <div className="mb-4">
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-bg-elevated text-xs text-content-secondary">
            <span>
              {mappedCount === 0 ? `${totalCount} unmapped` : `${totalCount - mappedCount} unmapped / ${totalCount} total`}
              {hasCategories &&
                ` (${categoryGroups.map((g) => `${g.units.length} ${g.label.toLowerCase()}`).join(", ")})`}
            </span>
            <button
              onClick={() => setSheetOpen(true)}
              className="text-accent-lighter hover:underline transition-colors cursor-pointer"
            >
              View all rooms
            </button>
          </div>
        </div>
      )}

      {/* ── Inline view for < COLLAPSE_THRESHOLD ── */}
      {!shouldCollapse && (
        <>
          {/* Quick select buttons */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {hasUnmapped && (
              <button
                onClick={selectUnmapped}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium text-accent-light border border-accent/30 hover:bg-accent/10 transition-colors cursor-pointer"
              >
                Unmapped
              </button>
            )}
            {hasCategories && categoryGroups.map((g) => (
              <button
                key={g.category}
                onClick={() => selectCategory(g.category)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium text-content-secondary border border-border hover:bg-bg-elevated transition-colors cursor-pointer"
              >
                {g.label}
              </button>
            ))}
            {selected.size > 0 && (
              <button
                onClick={clearSelection}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium text-content-tertiary border border-border hover:bg-bg-elevated transition-colors cursor-pointer"
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
                  <p className="text-xs text-content-tertiary font-medium mb-1.5">
                    {group.label} ({group.units.length})
                  </p>
                  {renderUnitChips(group.units)}
                </div>
              ))}
            </div>
          ) : (
            renderUnitChips(units)
          )}

          {/* Floating package picker when units selected */}
          {renderPackagePicker("mt-4 pt-3 border-t border-border/50")}
        </>
      )}

      {/* ── BottomSheet for large floors ── */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={`${label} -- All Rooms`}
      >
        {renderFullGrid()}
      </BottomSheet>
    </div>
  );
}
