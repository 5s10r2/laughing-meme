"use client";

import { useState } from "react";
import {
  Building2,
  Package,
  ArrowRightLeft,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "../../../lib/cn";
import { humanizeSharingType } from "../../../lib/property-utils";
import { motion, AnimatePresence } from "framer-motion";

interface PropertySection {
  propertyName?: string;
  propertyType?: string;
  location?: string;
  ownerName?: string;
}

interface FloorSummary {
  label: string;
  unitCount: number;
  nameRange?: string;
  unitBreakdown?: { category: string; label: string; count: number }[];
}

interface PackageSummary {
  name: string;
  rent?: number;
  ac?: boolean;
  sharingType?: string;
  attributes?: string[];
}

interface FloorAssignment {
  packageName: string;
  count: number;
}

interface MappingSummary {
  floorLabel: string;
  assignments?: FloorAssignment[];
  // Backward compat
  packageName?: string;
  count?: number;
}

interface PendingItem {
  description: string;
  severity: "error" | "warning";
}

interface VerificationSummaryProps {
  property?: PropertySection;
  floors?: FloorSummary[];
  packages?: PackageSummary[];
  mappings?: MappingSummary[];
  pending?: PendingItem[];
  onSendMessage?: (text: string) => void;
}

type SectionId = "property" | "structure" | "packages" | "mapping" | "pending";

function FieldRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-zinc-800/30 last:border-0">
      <span className="text-xs text-zinc-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-300">{value}</span>
        {onChange && (
          <button
            onClick={onChange}
            className="text-xs text-zinc-500 hover:text-amber-400 underline-offset-2 hover:underline transition-colors cursor-pointer px-2 py-1.5 -mr-2 -my-1.5 rounded"
          >
            change
          </button>
        )}
      </div>
    </div>
  );
}

export function VerificationSummary({
  property: rawProperty,
  floors: rawFloors,
  packages: rawPackages,
  mappings: rawMappings,
  pending: rawPending,
  onSendMessage,
  ...rest
}: VerificationSummaryProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed props from Claude

  // Property section
  const property: PropertySection | undefined = rawProperty
    || (rest.property_info as PropertySection)
    || (rest.property_details as PropertySection)
    || ((rest.property_name || rest.propertyName)
      ? {
          propertyName: (rest.property_name || rest.propertyName || rest.name) as string,
          propertyType: (rest.property_type || rest.propertyType || rest.type) as string,
          location: (rest.property_location || rest.location) as string,
          ownerName: (rest.owner_name || rest.ownerName || rest.user_name || rest.userName) as string,
        }
      : undefined);

  // Floors section
  const rawFloorList = rawFloors
    || (rest.floor_list as FloorSummary[])
    || (rest.structure as FloorSummary[])
    || (rest.floor_summary as FloorSummary[]);
  const floors: FloorSummary[] | undefined = Array.isArray(rawFloorList)
    ? (rawFloorList as unknown[]).map((raw: unknown) => {
        const f = raw as Record<string, unknown>;
        const rawBreakdown = f.unitBreakdown || f.unit_breakdown || f.breakdown;
        const unitBreakdown = Array.isArray(rawBreakdown)
          ? (rawBreakdown as unknown[]).map((b: unknown) => {
              const item = b as Record<string, unknown>;
              return {
                category: (item.category || item.type || "room") as string,
                label: (item.label || item.name || "Rooms") as string,
                count: Number(item.count ?? 0),
              };
            })
          : undefined;

        return {
          label: (f.label || f.floor_label || f.floorLabel || f.floor || f.name || "Floor") as string,
          unitCount: Number(
            f.unitCount ?? f.unit_count ?? f.units ?? f.rooms ?? f.room_count ??
            (Array.isArray(f.unit_names) ? f.unit_names.length : undefined) ??
            (Array.isArray(f.room_names) ? f.room_names.length : undefined) ??
            f.count ?? 0
          ),
          nameRange: (f.nameRange || f.name_range || f.range) as string | undefined,
          unitBreakdown,
        };
      })
    : undefined;

  // Packages section
  const rawPkgList = rawPackages
    || (rest.package_list as PackageSummary[])
    || (rest.package_summary as PackageSummary[]);
  const packages: PackageSummary[] | undefined = Array.isArray(rawPkgList)
    ? (rawPkgList as unknown[]).map((raw: unknown) => {
        const p = raw as Record<string, unknown>;
        return {
          name: (p.name || p.package_name || p.packageName || "Package") as string,
          rent: (p.rent || p.starting_rent || p.price || p.startingRent) as number | undefined,
          ac: p.ac as boolean | undefined,
          sharingType: (p.sharingType || p.sharing_type) as string | undefined,
          attributes: (p.attributes || p.tags) as string[] | undefined,
        };
      })
    : undefined;

  // Mappings section
  const rawMapList = rawMappings
    || (rest.mapping_list as MappingSummary[])
    || (rest.room_mappings as MappingSummary[])
    || (rest.mapping_summary as MappingSummary[]);
  const mappings: MappingSummary[] | undefined = Array.isArray(rawMapList)
    ? (rawMapList as unknown[]).map((raw: unknown) => {
        const m = raw as Record<string, unknown>;
        const rawAssignments = m.assignments || m.assignment_list || m.packages;
        const assignments: FloorAssignment[] | undefined = Array.isArray(rawAssignments)
          ? (rawAssignments as unknown[]).map((a: unknown) => {
              const item = a as Record<string, unknown>;
              return {
                packageName: (item.packageName || item.package_name || item.package || item.name || "Package") as string,
                count: Number(item.count ?? item.unitCount ?? item.unit_count ?? item.rooms ?? 0),
              };
            })
          : undefined;

        const packageName = (m.packageName || m.package_name || m.package) as string | undefined;
        const count = (m.count || m.unitCount || m.unit_count || m.rooms) as number | undefined;

        return {
          floorLabel: (m.floorLabel || m.floor_label || m.floor || "Floor") as string,
          assignments: assignments || (packageName ? [{ packageName, count: Number(count || 0) }] : undefined),
          packageName,
          count: Number(count || 0),
        };
      })
    : undefined;

  function getAssignments(m: MappingSummary): FloorAssignment[] {
    if (m.assignments && m.assignments.length > 0) return m.assignments;
    if (m.packageName) return [{ packageName: m.packageName, count: m.count || 0 }];
    return [];
  }

  // Pending section
  const rawPendList = rawPending
    || (rest.pending_items as PendingItem[])
    || (rest.issues as PendingItem[])
    || (rest.pending_issues as PendingItem[]);
  const pending: PendingItem[] | undefined = Array.isArray(rawPendList)
    ? (rawPendList as unknown[]).map((raw: unknown) => {
        const item = raw as Record<string, unknown>;
        return {
          description: (item.description || item.message || item.text || "Unknown issue") as string,
          severity: ((item.severity || item.level || "warning") as "error" | "warning"),
        };
      })
    : undefined;

  // ── Compute section summaries ──
  const totalRooms = floors?.reduce((sum, f) => sum + f.unitCount, 0) || 0;
  const totalMappedRooms = mappings?.reduce(
    (sum, m) => sum + getAssignments(m).reduce((a, b) => a + (b.count || 0), 0),
    0
  ) || 0;
  const allMapped = mappings && totalMappedRooms > 0;
  const hasPending = pending && pending.length > 0;
  const errorCount = pending?.filter((p) => p.severity === "error").length || 0;
  const warningCount = pending?.filter((p) => p.severity === "warning").length || 0;

  // ── Section data for accordion ──
  const sections: {
    id: SectionId;
    icon: React.ElementType;
    title: string;
    summary: string;
    badge?: { type: "ok" | "warning" | "error"; text: string };
    hasContent: boolean;
  }[] = [];

  if (property) {
    sections.push({
      id: "property",
      icon: Building2,
      title: "Property",
      summary: [property.propertyName, property.propertyType, property.location].filter(Boolean).join(" · "),
      badge: { type: "ok", text: "" },
      hasContent: true,
    });
  }

  if (floors && floors.length > 0) {
    sections.push({
      id: "structure",
      icon: Building2,
      title: "Structure",
      summary: `${floors.length} floor${floors.length !== 1 ? "s" : ""}, ${totalRooms} room${totalRooms !== 1 ? "s" : ""}`,
      badge: { type: "ok", text: "" },
      hasContent: true,
    });
  }

  if (packages && packages.length > 0) {
    // Group packages by sharing type for compact summary
    const sharingTypes = new Set(packages.map((p) => p.sharingType).filter(Boolean));
    const sharingStr = sharingTypes.size > 0
      ? Array.from(sharingTypes).map((st) => humanizeSharingType(st!)).join(", ")
      : "";
    sections.push({
      id: "packages",
      icon: Package,
      title: "Packages",
      summary: `${packages.length} package${packages.length !== 1 ? "s" : ""}${sharingStr ? ` (${sharingStr})` : ""}`,
      badge: { type: "ok", text: "" },
      hasContent: true,
    });
  }

  if (mappings && mappings.length > 0) {
    sections.push({
      id: "mapping",
      icon: ArrowRightLeft,
      title: "Mapping",
      summary: allMapped ? `${totalMappedRooms} room${totalMappedRooms !== 1 ? "s" : ""} mapped` : "Incomplete",
      badge: allMapped ? { type: "ok", text: "" } : { type: "warning", text: "!" },
      hasContent: true,
    });
  }

  if (hasPending) {
    sections.push({
      id: "pending",
      icon: AlertCircle,
      title: "Pending",
      summary: `${pending!.length} issue${pending!.length !== 1 ? "s" : ""}`,
      badge: errorCount > 0
        ? { type: "error", text: String(errorCount) }
        : { type: "warning", text: String(warningCount) },
      hasContent: true,
    });
  }

  // Default expanded: pending if it exists, otherwise nothing
  const defaultExpanded: SectionId | null = hasPending ? "pending" : null;
  const [expandedSection, setExpandedSection] = useState<SectionId | null>(defaultExpanded);

  function toggleSection(id: SectionId) {
    setExpandedSection((prev) => (prev === id ? null : id));
  }

  // ── Helpers ──
  function formatUnitBreakdown(floor: FloorSummary): string {
    if (floor.unitBreakdown && floor.unitBreakdown.length > 0) {
      return floor.unitBreakdown
        .filter((b) => b.count > 0)
        .map((b) => `${b.count} ${b.label.toLowerCase()}`)
        .join(", ");
    }
    return `${floor.unitCount} room${floor.unitCount !== 1 ? "s" : ""}`;
  }

  function renderBadge(badge: { type: "ok" | "warning" | "error"; text: string }) {
    if (badge.type === "ok") {
      return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
    }
    if (badge.type === "error") {
      return (
        <span className="flex items-center gap-0.5">
          <AlertCircle className="w-3 h-3 text-red-400" />
          {badge.text && <span className="text-[10px] text-red-400 font-medium">{badge.text}</span>}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-0.5">
        <AlertTriangle className="w-3 h-3 text-orange-400" />
        {badge.text && <span className="text-[10px] text-orange-400 font-medium">{badge.text}</span>}
      </span>
    );
  }

  // ── Render section content ──
  function renderSectionContent(id: SectionId) {
    switch (id) {
      case "property":
        if (!property) return null;
        return (
          <div className="space-y-0 px-1">
            {property.propertyName && (
              <FieldRow
                label="Name"
                value={property.propertyName}
                onChange={() => onSendMessage?.(`I want to change the property name, currently '${property.propertyName}'`)}
              />
            )}
            {property.propertyType && (
              <FieldRow
                label="Type"
                value={property.propertyType}
                onChange={() => onSendMessage?.(`I want to change the property type, currently '${property.propertyType}'`)}
              />
            )}
            {property.location && (
              <FieldRow
                label="Location"
                value={property.location}
                onChange={() => onSendMessage?.(`I want to change the location, currently '${property.location}'`)}
              />
            )}
            {property.ownerName && (
              <FieldRow
                label="Owner"
                value={property.ownerName}
                onChange={() => onSendMessage?.(`I want to change the owner name, currently '${property.ownerName}'`)}
              />
            )}
          </div>
        );

      case "structure":
        if (!floors) return null;
        return (
          <div className="space-y-0 px-1">
            {floors.map((floor, i) => (
              <FieldRow
                key={i}
                label={floor.label}
                value={`${formatUnitBreakdown(floor)}${floor.nameRange ? ` (${floor.nameRange})` : ""}`}
                onChange={() => onSendMessage?.(`I want to change ${floor.label}, it currently has ${formatUnitBreakdown(floor)}${floor.nameRange ? ` (${floor.nameRange})` : ""}`)}
              />
            ))}
          </div>
        );

      case "packages":
        if (!packages) return null;
        return (
          <div className="space-y-0 px-1">
            {packages.map((pkg, i) => {
              const rentStr = pkg.rent ? `₹${pkg.rent.toLocaleString("en-IN")}` : "";
              const sharingStr = pkg.sharingType || "";
              const attrs = pkg.attributes?.join(", ") || "";
              return (
                <div key={i} className="flex items-center justify-between py-1 border-b border-zinc-800/30 last:border-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-zinc-600">{pkg.name}</span>
                    {sharingStr && (
                      <span className="text-xs text-zinc-600 px-1.5 py-0.5 rounded bg-zinc-800/50 font-medium">
                        {sharingStr}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">
                      {rentStr && <span className="font-semibold text-zinc-200">{rentStr}</span>}
                      {rentStr && attrs && <span className="text-zinc-500"> · </span>}
                      {attrs && <span className="text-zinc-500">{attrs}</span>}
                      {!rentStr && !attrs && <span className="text-zinc-300">—</span>}
                    </span>
                    <button
                      onClick={() => onSendMessage?.(`I want to change the ${pkg.name} package${rentStr ? `, currently ${rentStr}` : ""}`)}
                      className="text-xs text-zinc-500 hover:text-amber-400 underline-offset-2 hover:underline transition-colors cursor-pointer px-2 py-1.5 -mr-2 -my-1.5 rounded"
                    >
                      change
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );

      case "mapping":
        if (!mappings) return null;
        return (
          <div className="space-y-0 px-1">
            {mappings.map((m, i) => {
              const assignments = getAssignments(m);
              const isMultiPackage = assignments.length > 1;

              if (!isMultiPackage) {
                const a = assignments[0];
                return (
                  <FieldRow
                    key={i}
                    label={m.floorLabel}
                    value={a ? `${a.count} room${a.count !== 1 ? "s" : ""} → ${a.packageName}` : "—"}
                    onChange={() => onSendMessage?.(`I want to change the mapping for ${m.floorLabel}`)}
                  />
                );
              }

              return (
                <div key={i} className="py-1 border-b border-zinc-800/30 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-600">{m.floorLabel}</span>
                    <button
                      onClick={() => onSendMessage?.(`I want to change the mapping for ${m.floorLabel}`)}
                      className="text-xs text-zinc-500 hover:text-amber-400 underline-offset-2 hover:underline transition-colors cursor-pointer px-2 py-1.5 -mr-2 -my-1.5 rounded"
                    >
                      change
                    </button>
                  </div>
                  <div className="pl-2 border-l border-zinc-700/40 space-y-0.5">
                    {assignments.map((a, ai) => (
                      <div key={ai} className="flex items-center gap-1.5 text-xs">
                        <span className="text-zinc-500">
                          {a.count} room{a.count !== 1 ? "s" : ""}
                        </span>
                        <ArrowRight className="w-2.5 h-2.5 text-zinc-600" />
                        <span className="text-zinc-300 font-medium">
                          {a.packageName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );

      case "pending":
        if (!pending) return null;
        return (
          <div className="space-y-1 px-1">
            {pending.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 text-xs py-1 px-2 rounded",
                  item.severity === "error"
                    ? "bg-red-500/10 text-red-300"
                    : "bg-orange-500/10 text-orange-300"
                )}
              >
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                <span>{item.description}</span>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="border border-zinc-800 bg-zinc-900/30 rounded-xl px-4 py-4 my-2">
      <p className="text-xs font-semibold text-zinc-200 mb-3">Final Review</p>

      {/* ── Accordion sections ── */}
      <div className="space-y-1 mb-4">
        {sections.map((section) => {
          const isOpen = expandedSection === section.id;
          const Icon = section.icon;

          return (
            <div key={section.id}>
              <button
                onClick={() => toggleSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all",
                  isOpen
                    ? "bg-zinc-800/50 border border-zinc-700/50"
                    : "bg-zinc-800/20 border border-transparent hover:bg-zinc-800/40"
                )}
              >
                <ChevronDown
                  className={cn(
                    "w-3 h-3 text-zinc-500 transition-transform duration-200 flex-shrink-0",
                    isOpen && "rotate-180"
                  )}
                />
                <Icon className="w-3 h-3 text-amber-400/70 flex-shrink-0" />
                <span className="text-zinc-300 font-medium">{section.title}</span>

                {/* Collapsed summary text */}
                {!isOpen && (
                  <span className="text-zinc-600 truncate text-[11px] ml-1">
                    — {section.summary}
                  </span>
                )}

                <span className="ml-auto flex-shrink-0">
                  {section.badge && renderBadge(section.badge)}
                </span>
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
                    <div className="pt-1 pb-2 px-1">
                      {renderSectionContent(section.id)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="pt-2 border-t border-zinc-800">
        {hasPending && (
          <p className="text-xs text-amber-400/70 mb-2">
            Resolve {pending!.length} pending item{pending!.length !== 1 ? "s" : ""} first
          </p>
        )}
        <button
          onClick={() => onSendMessage?.("Everything looks correct, confirm")}
          className={cn(
            "w-full px-3 py-2.5 rounded-lg text-[13px] font-semibold",
            "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
            "hover:bg-emerald-500/25 active:scale-95 transition-all",
            hasPending && "opacity-50 cursor-not-allowed"
          )}
          disabled={!!hasPending}
        >
          Everything looks great — go live! →
        </button>
      </div>
    </div>
  );
}
