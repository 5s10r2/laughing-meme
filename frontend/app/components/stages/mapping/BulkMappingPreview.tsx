"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, Check, ChevronDown } from "lucide-react";
import { cn } from "../../../lib/cn";
import {
  ICON_CIRCLE, BTN_PRIMARY, BTN_SECONDARY,
} from "../../ui/primitives";
import { motion, AnimatePresence } from "framer-motion";

interface FloorAssignment {
  packageName: string;
  unitCount: number;
}

interface BulkOperation {
  floorLabel: string;
  assignments?: FloorAssignment[];
  // Backward compat: single-package shorthand
  unitCount?: number;
  packageName?: string;
}

interface BulkMappingPreviewProps {
  description: string;
  operations: BulkOperation[];
  totalUnits: number;
  totalFloors: number;
  onSendMessage?: (text: string) => void;
}

/** Threshold for switching from flat floor list to package-grouped accordion */
const GROUPED_THRESHOLD = 4;

export function BulkMappingPreview({
  description: rawDescription,
  operations: rawOperations,
  totalUnits: rawTotalUnits,
  totalFloors: rawTotalFloors,
  onSendMessage,
  ...rest
}: BulkMappingPreviewProps & Record<string, unknown>) {
  const [expandedPkg, setExpandedPkg] = useState<string | null>(null);

  // Defensive: handle missing/malformed props from Claude
  const rawList = Array.isArray(rawOperations)
    ? rawOperations
    : Array.isArray((rest as Record<string, unknown>).suggestions)
      ? ((rest as Record<string, unknown>).suggestions as BulkOperation[])
      : Array.isArray((rest as Record<string, unknown>).mappings)
        ? ((rest as Record<string, unknown>).mappings as BulkOperation[])
        : Array.isArray((rest as Record<string, unknown>).assignments)
          ? ((rest as Record<string, unknown>).assignments as BulkOperation[])
          : Array.isArray((rest as Record<string, unknown>).floors)
            ? ((rest as Record<string, unknown>).floors as BulkOperation[])
            : Array.isArray((rest as Record<string, unknown>).items)
              ? ((rest as Record<string, unknown>).items as BulkOperation[])
              : [];

  const operations: BulkOperation[] = (rawList as unknown[]).map((raw: unknown) => {
    const op = raw as Record<string, unknown>;

    // Parse assignments array
    const rawAssignments = op.assignments || op.assignment_list || op.packages || op.package_assignments;
    const assignments: FloorAssignment[] | undefined = Array.isArray(rawAssignments)
      ? (rawAssignments as unknown[]).map((a: unknown) => {
          const item = a as Record<string, unknown>;
          return {
            packageName: (item.packageName || item.package_name || item.package || item.name || "Unknown") as string,
            unitCount: Number(item.unitCount ?? item.unit_count ?? item.count ?? item.rooms ?? 0),
          };
        })
      : undefined;

    // Backward compat single fields
    const packageName = (op.packageName || op.package_name || op.package) as string | undefined;
    const unitCount = Number(op.unitCount ?? op.unit_count ?? op.count ?? op.rooms ?? op.room_count ?? op.units ?? 0);

    return {
      floorLabel: (op.floorLabel || op.floor_label || op.floor || op.label || "Unknown Floor") as string,
      assignments: assignments || (packageName ? [{ packageName, unitCount }] : undefined),
      unitCount,
      packageName: packageName || "Unknown Package",
    };
  });

  // Resolve assignments per operation
  function getAssignments(op: BulkOperation): FloorAssignment[] {
    if (op.assignments && op.assignments.length > 0) return op.assignments;
    if (op.packageName) return [{ packageName: op.packageName, unitCount: op.unitCount || 0 }];
    return [];
  }

  const totalUnits = rawTotalUnits
    || (rest.total_units as number)
    || (rest.total_rooms as number)
    || (rest.totalRooms as number)
    || (rest.room_count as number)
    || operations.reduce((sum, op) => sum + getAssignments(op).reduce((a, b) => a + (b.unitCount || 0), 0), 0)
    || 0;
  const totalFloors = rawTotalFloors
    || (rest.total_floors as number)
    || (rest.floor_count as number)
    || operations.length
    || 0;
  const description = rawDescription || (rest.description as string) || (rest.title as string) || `Assign ${totalUnits} room${totalUnits !== 1 ? "s" : ""} across ${totalFloors} floor${totalFloors !== 1 ? "s" : ""}`;

  // Count total assignment rows for threshold
  const totalAssignmentRows = operations.reduce((sum, op) => sum + getAssignments(op).length, 0);
  const useGrouped = totalAssignmentRows >= GROUPED_THRESHOLD;

  // ── Build package-grouped view ──
  interface PackageGroup {
    packageName: string;
    totalUnits: number;
    floors: { floorLabel: string; unitCount: number }[];
  }

  const packageGroups: PackageGroup[] = [];
  if (useGrouped) {
    const groupMap = new Map<string, { totalUnits: number; floors: { floorLabel: string; unitCount: number }[] }>();
    for (const op of operations) {
      for (const a of getAssignments(op)) {
        if (!groupMap.has(a.packageName)) {
          groupMap.set(a.packageName, { totalUnits: 0, floors: [] });
        }
        const group = groupMap.get(a.packageName)!;
        group.totalUnits += a.unitCount;
        group.floors.push({ floorLabel: op.floorLabel, unitCount: a.unitCount });
      }
    }
    for (const [name, data] of groupMap) {
      packageGroups.push({ packageName: name, ...data });
    }
  }

  function handleConfirm() {
    const summary = operations
      .map((op) => {
        const assignments = getAssignments(op);
        const parts = assignments
          .map((a) => `${a.unitCount} room${a.unitCount !== 1 ? "s" : ""} → ${a.packageName}`)
          .join(", ");
        return `${op.floorLabel}: ${parts}`;
      })
      .join("; ");
    onSendMessage?.(`Confirm mapping: ${summary}`);
  }

  return (
    <div className="bg-warning/5 border border-warning/15 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn(ICON_CIRCLE, "bg-warning/10")}>
          <AlertTriangle className="w-4 h-4 text-warning" />
        </div>
        <div>
          <p className="text-sm font-semibold text-content">{description}</p>
          <p className="text-[11px] text-content-tertiary mt-0.5">
            This will assign packages to {totalUnits} room{totalUnits !== 1 ? "s" : ""} across {totalFloors}{" "}
            floor{totalFloors !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* ── Package-grouped accordion (4+ assignment rows) ── */}
      {useGrouped ? (
        <div className="space-y-2 mb-5">
          {packageGroups.map((group) => {
            const isOpen = expandedPkg === group.packageName;
            return (
              <div key={group.packageName}>
                <button
                  onClick={() => setExpandedPkg(isOpen ? null : group.packageName)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all cursor-pointer",
                    isOpen
                      ? "bg-bg-surface/50 border border-border"
                      : "bg-bg-surface/50 border border-border hover:bg-bg-elevated"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 text-content-tertiary transition-transform duration-200",
                        isOpen && "rotate-180"
                      )}
                    />
                    <span className="text-content font-medium">{group.packageName}</span>
                    <span className="text-content-tertiary text-[11px]">
                      ({group.totalUnits} room{group.totalUnits !== 1 ? "s" : ""})
                    </span>
                  </div>
                  <span className="text-content-tertiary text-[11px]">
                    {group.floors.length} floor{group.floors.length !== 1 ? "s" : ""}
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
                      <div className="pl-8 pt-1 space-y-0.5">
                        {group.floors.map((f, fi) => (
                          <div
                            key={fi}
                            className="flex items-center justify-between text-xs py-1"
                          >
                            <span className="text-content-secondary">{f.floorLabel}</span>
                            <span className="text-content-tertiary font-mono">
                              {f.unitCount} room{f.unitCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Flat floor-based view (< 4 assignment rows) ── */
        <div className="space-y-2 mb-5">
          {operations.map((op, i) => {
            const assignments = getAssignments(op);

            return (
              <div
                key={i}
                className="flex items-center gap-3 py-3 px-4 rounded-xl bg-bg-surface/50 border border-border"
              >
                <div className="flex-1">
                  <p className="text-sm text-content">{op.floorLabel}</p>
                  <p className="text-[11px] text-content-tertiary">
                    {assignments.reduce((sum, a) => sum + a.unitCount, 0)} rooms
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-content-tertiary" />
                <p className="text-sm text-content font-medium">
                  {assignments.map((a) => a.packageName).join(", ")}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => onSendMessage?.("No, I want to change this")}
          className={cn(BTN_SECONDARY, "flex-1")}
        >
          Go back
        </button>
        <button
          onClick={handleConfirm}
          className={cn(BTN_PRIMARY, "flex-1")}
        >
          <span className="inline-flex items-center gap-2">
            Confirm <Check className="w-4 h-4" />
          </span>
        </button>
      </div>
    </div>
  );
}
