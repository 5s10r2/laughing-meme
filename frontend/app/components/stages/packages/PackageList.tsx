"use client";

import { useState } from "react";
import { Package as PackageIcon, Snowflake, Fan, ChevronDown } from "lucide-react";
import { cn } from "../../../lib/cn";
import { humanizeSharingType } from "../../../lib/property-utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Package } from "../../../lib/types";

interface PackageListProps {
  packages: Package[];
  onSendMessage?: (text: string) => void;
}

/** Threshold for switching from flat list to accordion groups */
const ACCORDION_THRESHOLD = 5;

export function PackageList({ packages: rawPackages, onSendMessage, ...rest }: PackageListProps & Record<string, unknown>) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

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
      category: (p.category || p.type || "") as string,
      sharing_type: (p.sharing_type || p.sharingType) as string | undefined,
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

  // Group by sharing type
  const groups: { sharingType: string; label: string; packages: Package[]; rentRange: string }[] = [];
  const groupMap = new Map<string, Package[]>();
  for (const pkg of activePackages) {
    const st = pkg.sharing_type || "other";
    if (!groupMap.has(st)) groupMap.set(st, []);
    groupMap.get(st)!.push(pkg);
  }
  for (const [st, pkgs] of groupMap) {
    const rents = pkgs.map((p) => p.starting_rent || 0).filter(Boolean);
    const minRent = Math.min(...rents);
    const maxRent = Math.max(...rents);
    const rentRange = rents.length > 0
      ? minRent === maxRent
        ? `₹${minRent.toLocaleString("en-IN")}`
        : `₹${minRent.toLocaleString("en-IN")}–₹${maxRent.toLocaleString("en-IN")}`
      : "";
    groups.push({
      sharingType: st,
      label: st === "other" ? "Other" : humanizeSharingType(st),
      packages: pkgs,
      rentRange,
    });
  }

  const useAccordion = activePackages.length >= ACCORDION_THRESHOLD && groups.length > 1;

  // Auto-expand first group on accordion mode
  if (useAccordion && expandedGroup === null && groups.length > 0) {
    // Will be set on first render via the default state
  }

  function toggleGroup(sharingType: string) {
    setExpandedGroup((prev) => (prev === sharingType ? null : sharingType));
    setEditingId(null); // close any open inline edit
  }

  function renderPackageRow(pkg: Package) {
    const isEditing = editingId === pkg.id;
    return (
      <div key={pkg.id}>
        <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-zinc-800/40 text-xs">
          <div className="flex items-center gap-2">
            {pkg.amenities?.includes("AC") ? (
              <Snowflake className="w-3 h-3 text-blue-400" />
            ) : (
              <Fan className="w-3 h-3 text-zinc-500" />
            )}
            <span className="text-zinc-300 font-medium">{pkg.name}</span>
            {/* Sharing type badge — only in flat mode (accordion headers already show it) */}
            {!useAccordion && pkg.sharing_type && (
              <span className="px-1.5 py-0.5 rounded bg-zinc-700/60 text-[10px] font-medium text-zinc-400">
                {humanizeSharingType(pkg.sharing_type)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {pkg.starting_rent ? (
              <span className="text-sm font-semibold text-zinc-200">
                ₹{pkg.starting_rent.toLocaleString("en-IN")}
              </span>
            ) : null}
            <button
              onClick={() => setEditingId(isEditing ? null : pkg.id)}
              className="text-xs text-zinc-500 hover:text-amber-400 underline-offset-2 hover:underline transition-colors cursor-pointer px-2 py-1.5 -mr-2 -my-1.5 rounded"
            >
              {isEditing ? "close" : "change"}
            </button>
          </div>
        </div>

        {/* Inline edit panel */}
        <AnimatePresence>
          {isEditing && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <InlinePackageEdit
                pkg={pkg}
                onSave={(msg) => {
                  setEditingId(null);
                  onSendMessage?.(msg);
                }}
                onCancel={() => setEditingId(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 bg-zinc-900/30 rounded-xl px-3 py-3 my-2">
      <div className="flex items-center gap-2 mb-2.5">
        <PackageIcon className="w-3.5 h-3.5 text-amber-400/70" />
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Packages
        </span>
        <span className="text-xs text-zinc-600 ml-auto">
          {activePackages.length} active
        </span>
      </div>

      {/* ── Accordion mode (5+ packages, multiple groups) ── */}
      {useAccordion ? (
        <div className="space-y-1">
          {groups.map((group) => {
            const isOpen = expandedGroup === group.sharingType;
            return (
              <div key={group.sharingType}>
                <button
                  onClick={() => toggleGroup(group.sharingType)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all",
                    isOpen
                      ? "bg-zinc-800/60 border border-zinc-700/50"
                      : "bg-zinc-800/30 border border-transparent hover:bg-zinc-800/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown
                      className={cn(
                        "w-3 h-3 text-zinc-500 transition-transform duration-200",
                        isOpen && "rotate-180"
                      )}
                    />
                    <span className="text-zinc-300 font-medium">{group.label}</span>
                    <span className="text-zinc-600">({group.packages.length})</span>
                  </div>
                  {group.rentRange && (
                    <span className="text-zinc-500 text-[11px]">{group.rentRange}</span>
                  )}
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1 pt-1 pl-2">
                        {group.packages.map(renderPackageRow)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Flat view (< ACCORDION_THRESHOLD or single group) ── */
        <div className="space-y-1">
          {activePackages.map(renderPackageRow)}
        </div>
      )}
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
  const [sharingType, setSharingType] = useState(pkg.sharing_type || "private");

  function handleSave() {
    const rentNum = parseInt(rent, 10) || pkg.starting_rent || 0;
    const sharingLabel = humanizeSharingType(sharingType);
    const msg = `Update ${pkg.name}: ${sharingLabel}, rent ₹${rentNum.toLocaleString("en-IN")}, ${ac ? "AC" : "non-AC"}, food ${food}, ${furnishing}`;
    onSave(msg);
  }

  return (
    <div className="px-2.5 py-2.5 bg-zinc-800/30 rounded-b-lg border-x border-b border-zinc-800/50 space-y-2">
      {/* Sharing Type */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-zinc-500 w-16">Type</label>
        <div className="flex gap-1">
          {["private", "double", "triple", "dormitory"].map((opt) => (
            <button
              key={opt}
              onClick={() => setSharingType(opt)}
              className={cn(
                "px-2 py-0.5 rounded text-xs font-medium transition-all border capitalize",
                sharingType === opt
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:border-zinc-600"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Rent */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-zinc-500 w-16">Rent</label>
        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-500">₹</span>
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
        <label className="text-xs text-zinc-500 w-16">AC</label>
        <button
          onClick={() => setAc(!ac)}
          className={cn(
            "px-2.5 py-0.5 rounded text-xs font-medium transition-all border",
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
        <label className="text-xs text-zinc-500 w-16">Food</label>
        <div className="flex gap-1">
          {["included", "optional", "not included"].map((opt) => (
            <button
              key={opt}
              onClick={() => setFood(opt)}
              className={cn(
                "px-2 py-0.5 rounded text-xs font-medium transition-all border",
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
        <label className="text-xs text-zinc-500 w-16">Furnishing</label>
        <div className="flex gap-1">
          {["furnished", "semi furnished", "unfurnished"].map((opt) => (
            <button
              key={opt}
              onClick={() => setFurnishing(opt)}
              className={cn(
                "px-2 py-0.5 rounded text-xs font-medium transition-all border capitalize",
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
