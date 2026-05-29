"use client";

import { useState } from "react";
import {
  Snowflake, Fan, ChevronDown, Check,
} from "lucide-react";
import { cn } from "../../../lib/cn";
import { humanizeSharingType } from "../../../lib/property-utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Package } from "../../../lib/types";
import {
  CARD, ICON_SM, BTN_PRIMARY, BTN_SECONDARY,
  EditButton,
} from "../../ui/primitives";

/** Labelled segmented toggle used in the inline package editor. */
function ToggleRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs text-content-tertiary w-20 flex-shrink-0">{label}</label>
      <div className="flex gap-1.5 flex-1">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer capitalize",
              value === o.value
                ? "border-accent/30 bg-accent/8 text-accent-lighter"
                : "border-border bg-bg-elevated text-content-tertiary hover:bg-bg-subtle"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
      security_deposit: (p.security_deposit ?? p.securityDeposit ?? p.deposit) as number | undefined,
      lock_in_period: (p.lock_in_period ?? p.lockIn) as number | undefined,
      notice_period: (p.notice_period ?? p.notice) as number | undefined,
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

  function toggleGroup(sharingType: string) {
    setExpandedGroup((prev) => (prev === sharingType ? null : sharingType));
    setEditingId(null);
  }

  function renderPackageRow(pkg: Package) {
    const isEditing = editingId === pkg.id;
    const isAC = pkg.amenities?.includes("AC");

    return (
      <div key={pkg.id} className="rounded-xl border border-border bg-bg-elevated">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className={cn(ICON_SM, isAC ? "bg-info/10" : "bg-bg-subtle")}>
              {isAC ? <Snowflake className="w-3 h-3 text-info" /> : <Fan className="w-3 h-3 text-content-tertiary" />}
            </div>
            <div>
              <p className="text-sm text-content font-medium">{pkg.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {pkg.starting_rent ? (
                  <span className="text-xs text-content-secondary">
                    ₹{pkg.starting_rent.toLocaleString("en-IN")}/mo
                  </span>
                ) : null}
                {!useAccordion && pkg.sharing_type && (
                  <>
                    <span className="text-content-tertiary">·</span>
                    <span className="text-xs text-content-tertiary">
                      {humanizeSharingType(pkg.sharing_type)}
                    </span>
                  </>
                )}
                {pkg.furnishing && (
                  <>
                    <span className="text-content-tertiary">·</span>
                    <span className="text-xs text-content-tertiary">
                      {String(pkg.furnishing).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <EditButton onClick={() => setEditingId(isEditing ? null : pkg.id)} />
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
    <div className={CARD}>
      <p className="text-xs font-medium text-content-tertiary mb-4">Your packages</p>

      {/* Accordion mode (5+ packages, multiple groups) */}
      {useAccordion ? (
        <div className="space-y-2">
          {groups.map((group) => {
            const isOpen = expandedGroup === group.sharingType;
            return (
              <div key={group.sharingType}>
                <button
                  onClick={() => toggleGroup(group.sharingType)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all",
                    isOpen
                      ? "bg-bg-elevated border border-border"
                      : "bg-bg-elevated/30 border border-transparent hover:bg-bg-elevated/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 text-content-tertiary transition-transform duration-200",
                        isOpen && "rotate-180"
                      )}
                    />
                    <span className="text-content-secondary font-medium">{group.label}</span>
                    <span className="text-content-tertiary text-xs">({group.packages.length})</span>
                  </div>
                  {group.rentRange && (
                    <span className="text-content-tertiary text-xs">{group.rentRange}</span>
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
                      <div className="space-y-2 pt-2 pl-2">
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
        /* Flat view */
        <div className="space-y-2">
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
    <div className="px-4 pb-4 pt-3 border-t border-border space-y-3">
      <ToggleRow
        label="Type"
        options={[
          { value: "private", label: "Private" },
          { value: "double", label: "Double" },
          { value: "triple", label: "Triple" },
          { value: "dormitory", label: "Dorm" },
        ]}
        value={sharingType}
        onChange={setSharingType}
      />

      {/* Rent */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-content-tertiary w-20 flex-shrink-0">Rent</label>
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-sm text-content-tertiary font-medium">₹</span>
          <input
            type="number"
            value={rent}
            onChange={(e) => setRent(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-bg-elevated border border-border text-sm text-content focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20"
          />
        </div>
      </div>

      {/* AC toggle */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-content-tertiary w-20 flex-shrink-0">AC</label>
        <button
          onClick={() => setAc(!ac)}
          role="switch"
          aria-checked={ac}
          className={cn(
            "w-11 h-6 rounded-full transition-all duration-200 relative cursor-pointer",
            ac ? "bg-accent" : "bg-bg-subtle"
          )}
        >
          <div
            className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-200"
            style={{ left: ac ? "22px" : "2px" }}
          />
        </button>
      </div>

      <ToggleRow
        label="Food"
        options={[
          { value: "included", label: "Included" },
          { value: "optional", label: "Optional" },
          { value: "not included", label: "None" },
        ]}
        value={food}
        onChange={setFood}
      />

      <ToggleRow
        label="Furnishing"
        options={[
          { value: "furnished", label: "Furnished" },
          { value: "semi furnished", label: "Semi" },
          { value: "unfurnished", label: "Unfurn." },
        ]}
        value={furnishing}
        onChange={setFurnishing}
      />

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-border">
        <button onClick={handleSave} className={cn(BTN_PRIMARY, "flex-1")}>
          <span className="inline-flex items-center justify-center gap-2">
            Save changes <Check className="w-4 h-4" />
          </span>
        </button>
        <button onClick={onCancel} className={BTN_SECONDARY}>
          Cancel
        </button>
      </div>
    </div>
  );
}
