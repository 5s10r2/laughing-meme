"use client";

import { useState } from "react";
import {
  Building2,
  Package,
  ArrowRightLeft,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Check,
  AlertTriangle,
  Layers,
  Box,
} from "lucide-react";
import { cn } from "../../../lib/cn";
import { humanizeSharingType } from "../../../lib/property-utils";
import {
  CARD, CARD_DIVIDER, ICON_CIRCLE, ICON_SM, BTN_PRIMARY, EditButton,
} from "../../ui/primitives";
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

  // ── Section icon map ──
  const sectionIcons: Record<SectionId, React.ElementType> = {
    property: Building2,
    structure: Layers,
    packages: Box,
    mapping: ArrowRightLeft,
    pending: AlertCircle,
  };

  // ── Section data for accordion ──
  const sections: {
    id: SectionId;
    title: string;
    summary: string;
    hasContent: boolean;
  }[] = [];

  if (property) {
    sections.push({
      id: "property",
      title: "Property",
      summary: [property.propertyName, property.propertyType, property.location].filter(Boolean).join(" · "),
      hasContent: true,
    });
  }

  if (floors && floors.length > 0) {
    sections.push({
      id: "structure",
      title: "Structure",
      summary: `${floors.length} floor${floors.length !== 1 ? "s" : ""} · ${totalRooms} room${totalRooms !== 1 ? "s" : ""}`,
      hasContent: true,
    });
  }

  if (packages && packages.length > 0) {
    const sharingTypes = new Set(packages.map((p) => p.sharingType).filter(Boolean));
    const sharingStr = sharingTypes.size > 0
      ? Array.from(sharingTypes).map((st) => humanizeSharingType(st!)).join(", ")
      : "";
    sections.push({
      id: "packages",
      title: "Packages",
      summary: `${packages.length} package${packages.length !== 1 ? "s" : ""}${sharingStr ? ` (${sharingStr})` : ""}`,
      hasContent: true,
    });
  }

  if (mappings && mappings.length > 0) {
    sections.push({
      id: "mapping",
      title: "Mapping",
      summary: allMapped ? `${totalMappedRooms} room${totalMappedRooms !== 1 ? "s" : ""} mapped` : "Incomplete",
      hasContent: true,
    });
  }

  if (hasPending) {
    sections.push({
      id: "pending",
      title: "Pending",
      summary: `${pending!.length} issue${pending!.length !== 1 ? "s" : ""}`,
      hasContent: true,
    });
  }

  // Default expanded: first section if it exists
  const defaultExpanded: SectionId | null = sections.length > 0 ? sections[0].id : null;
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

  // ── Render section content ──
  function renderSectionContent(id: SectionId) {
    switch (id) {
      case "property":
        if (!property) return null;
        return (
          <div className="pl-12 pb-3 space-y-2.5">
            {property.ownerName && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-content-tertiary">Owner</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-content font-medium">{property.ownerName}</span>
                  <EditButton onClick={() => onSendMessage?.(`I want to change the owner name, currently '${property.ownerName}'`)} />
                </div>
              </div>
            )}
            {property.propertyType && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-content-tertiary">Type</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-content font-medium">{property.propertyType}</span>
                  <EditButton onClick={() => onSendMessage?.(`I want to change the property type, currently '${property.propertyType}'`)} />
                </div>
              </div>
            )}
            {property.location && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-content-tertiary">Location</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-content font-medium">{property.location}</span>
                  <EditButton onClick={() => onSendMessage?.(`I want to change the location, currently '${property.location}'`)} />
                </div>
              </div>
            )}
          </div>
        );

      case "structure":
        if (!floors) return null;
        return (
          <div className="pl-12 pb-3 space-y-2.5">
            {floors.map((floor, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-content-tertiary">{floor.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-content font-medium">
                    {formatUnitBreakdown(floor)}{floor.nameRange ? ` (${floor.nameRange})` : ""}
                  </span>
                  <EditButton onClick={() => onSendMessage?.(`I want to change ${floor.label}`)} />
                </div>
              </div>
            ))}
          </div>
        );

      case "packages":
        if (!packages) return null;
        return (
          <div className="pl-12 pb-3 space-y-2.5">
            {packages.map((pkg, i) => {
              const rentStr = pkg.rent ? `₹${pkg.rent.toLocaleString("en-IN")}` : "";
              return (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-content-tertiary">{pkg.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-content font-medium">{rentStr || "---"}</span>
                    <EditButton onClick={() => onSendMessage?.(`I want to change the ${pkg.name} package`)} />
                  </div>
                </div>
              );
            })}
          </div>
        );

      case "mapping":
        if (!mappings) return null;
        return (
          <div className="pl-12 pb-3 space-y-2.5">
            {mappings.map((m, i) => {
              const assignments = getAssignments(m);
              const isMultiPackage = assignments.length > 1;

              if (!isMultiPackage) {
                const a = assignments[0];
                return (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-content-tertiary">{m.floorLabel}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-content font-medium">
                        {a ? `${a.count} room${a.count !== 1 ? "s" : ""} → ${a.packageName}` : "---"}
                      </span>
                      <EditButton onClick={() => onSendMessage?.(`I want to change the mapping for ${m.floorLabel}`)} />
                    </div>
                  </div>
                );
              }

              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-content-tertiary">{m.floorLabel}</span>
                    <EditButton onClick={() => onSendMessage?.(`I want to change the mapping for ${m.floorLabel}`)} />
                  </div>
                  <div className="pl-2 border-l border-border space-y-0.5">
                    {assignments.map((a, ai) => (
                      <div key={ai} className="flex items-center gap-1.5 text-xs">
                        <span className="text-content-tertiary">
                          {a.count} room{a.count !== 1 ? "s" : ""}
                        </span>
                        <ArrowRight className="w-2.5 h-2.5 text-content-tertiary" />
                        <span className="text-content font-medium">
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
          <div className="pl-12 pb-3 space-y-1">
            {pending.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 text-xs py-1 px-2 rounded",
                  item.severity === "error"
                    ? "bg-error/10 text-error"
                    : "bg-warning/10 text-warning"
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
    <div className={CARD}>
      <p className="text-xs font-medium text-content-tertiary mb-4">Final review</p>

      {/* ── Accordion sections ── */}
      <div className="space-y-0">
        {sections.map((section, i) => {
          const isOpen = expandedSection === section.id;
          const Icon = sectionIcons[section.id];

          return (
            <div key={section.id} className={cn(i < sections.length - 1 && CARD_DIVIDER)}>
              <button
                onClick={() => toggleSection(section.id)}
                className="flex items-center justify-between w-full py-3.5 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(ICON_CIRCLE, "bg-bg-elevated")}>
                    <Icon className="w-4 h-4 text-content-tertiary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-content font-medium">{section.title}</p>
                    {!isOpen && (
                      <p className="text-[11px] text-content-tertiary mt-0.5">{section.summary}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {section.id !== "pending" && (
                    <div className={cn(ICON_SM, "bg-success/12")}>
                      <Check className="w-3 h-3 text-success" />
                    </div>
                  )}
                  {section.id === "pending" && (
                    <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                  )}
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-content-tertiary transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </div>
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
                    {renderSectionContent(section.id)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-5">
        {hasPending && (
          <p className="text-xs text-warning mb-2">
            Resolve {pending!.length} pending item{pending!.length !== 1 ? "s" : ""} first
          </p>
        )}
        <button
          onClick={() => onSendMessage?.("Everything looks correct, confirm")}
          className={cn(
            BTN_PRIMARY,
            hasPending && "opacity-50 cursor-not-allowed"
          )}
          disabled={!!hasPending}
        >
          <span className="inline-flex items-center gap-2">
            Confirm & finish <Check className="w-4 h-4" />
          </span>
        </button>
      </div>
    </div>
  );
}
