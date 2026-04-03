"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "../../../lib/cn";
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
    <div className="border border-amber-500/20 border-l-2 border-l-amber-500/30 bg-amber-500/5 rounded-xl px-4 py-3.5 my-2">
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs text-zinc-200 font-medium">{description}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {totalUnits} room{totalUnits !== 1 ? "s" : ""} across {totalFloors}{" "}
            floor{totalFloors !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* ── Package-grouped accordion (4+ assignment rows) ── */}
      {useGrouped ? (
        <div className="space-y-1 mb-3">
          {packageGroups.map((group) => {
            const isOpen = expandedPkg === group.packageName;
            return (
              <div key={group.packageName}>
                <button
                  onClick={() => setExpandedPkg(isOpen ? null : group.packageName)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all",
                    isOpen
                      ? "bg-zinc-800/50 border border-zinc-700/50"
                      : "bg-zinc-800/30 border border-transparent hover:bg-zinc-800/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown
                      className={cn(
                        "w-3 h-3 text-zinc-500 transition-transform duration-200",
                        isOpen && "rotate-180"
                      )}
                    />
                    <span className="text-amber-300/80 font-medium">{group.packageName}</span>
                    <span className="text-zinc-500">
                      ({group.totalUnits} room{group.totalUnits !== 1 ? "s" : ""})
                    </span>
                  </div>
                  <span className="text-zinc-600 text-[11px]">
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
                      <div className="pl-5 pt-1 space-y-0.5">
                        {group.floors.map((f, fi) => (
                          <div
                            key={fi}
                            className="flex items-center justify-between text-xs py-0.5"
                          >
                            <span className="text-zinc-400">{f.floorLabel}</span>
                            <span className="text-zinc-500 font-mono">
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
        <div className="space-y-1 mb-3">
          {operations.map((op, i) => {
            const assignments = getAssignments(op);
            const isMultiPackage = assignments.length > 1;

            return (
              <div
                key={i}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800/40 text-xs"
              >
                {!isMultiPackage ? (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">{op.floorLabel}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 font-mono text-xs">
                        {assignments[0]?.unitCount || 0} room{(assignments[0]?.unitCount || 0) !== 1 ? "s" : ""}
                      </span>
                      <span className="text-amber-300/80 font-medium text-xs">
                        {assignments[0]?.packageName || "—"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-zinc-400 font-medium mb-1">{op.floorLabel}</p>
                    <div className="pl-2 border-l border-zinc-700/50 space-y-0.5">
                      {assignments.map((a, ai) => (
                        <div key={ai} className="flex items-center gap-2">
                          <span className="text-zinc-500 font-mono">
                            {a.unitCount} room{a.unitCount !== 1 ? "s" : ""}
                          </span>
                          <ArrowRight className="w-2.5 h-2.5 text-zinc-600" />
                          <span className="text-amber-300/80 font-medium">
                            {a.packageName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-amber-500/10">
        <button
          onClick={handleConfirm}
          className={cn(
            "flex-1 px-3 py-2.5 rounded-lg text-[13px] font-semibold",
            "bg-amber-500/20 text-amber-300 border border-amber-500/30",
            "hover:bg-amber-500/30 active:scale-95 transition-all"
          )}
        >
          Confirm mapping for {totalUnits} room{totalUnits !== 1 ? "s" : ""}{useGrouped ? ` across ${packageGroups.length} package${packageGroups.length !== 1 ? "s" : ""}` : ""} →
        </button>
        <button
          onClick={() => onSendMessage?.("No, I want to change this")}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 border border-zinc-700 hover:bg-zinc-800 active:scale-95 transition-all"
        >
          Go back
        </button>
      </div>
    </div>
  );
}
