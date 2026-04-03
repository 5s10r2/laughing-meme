"use client";

import { useState } from "react";
import { Sparkles, ArrowRight, Check } from "lucide-react";
import { cn } from "../../../lib/cn";
import { FloorChipBar } from "../../ui/FloorChipBar";

interface FloorAssignment {
  packageName: string;
  unitCount: number;
}

interface MappingSuggestion {
  floorLabel: string;
  floorIndex: number;
  assignments?: FloorAssignment[];
  // Backward compat: single-package shorthand
  packageName?: string;
  unitCount?: number;
}

interface MappingSuggestionCardProps {
  suggestions: MappingSuggestion[];
  onSendMessage?: (text: string) => void;
}

/** Threshold at which we switch from flat list to floor-by-floor review */
const REVIEW_THRESHOLD = 3;

export function MappingSuggestionCard({
  suggestions: rawSuggestions,
  onSendMessage,
  ...rest
}: MappingSuggestionCardProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed suggestions from Claude
  const suggestions: MappingSuggestion[] = Array.isArray(rawSuggestions)
    ? (rawSuggestions as unknown[]).map((raw: unknown, i: number) => {
        const s = raw as Record<string, unknown>;

        // Try to parse assignments array
        const rawAssignments =
          s.assignments || s.assignment_list || s.packages || s.package_assignments;
        const assignments: FloorAssignment[] | undefined = Array.isArray(rawAssignments)
          ? (rawAssignments as unknown[]).map((a: unknown) => {
              const item = a as Record<string, unknown>;
              return {
                packageName: (item.packageName || item.package_name || item.package || item.name || "Unknown") as string,
                unitCount: Number(item.unitCount ?? item.unit_count ?? item.count ?? item.rooms ?? 0),
              };
            })
          : undefined;

        // Backward compat: single package fields
        const packageName = (s.packageName || s.package_name || s.package) as string | undefined;
        const unitCount = (s.unitCount || s.unit_count || s.count || s.rooms) as number | undefined;

        return {
          floorLabel: (s.floorLabel || s.floor_label || s.floor || s.label || `Floor ${i}`) as string,
          floorIndex: (s.floorIndex ?? s.floor_index ?? i) as number,
          assignments:
            assignments ||
            (packageName ? [{ packageName, unitCount: Number(unitCount || 0) }] : undefined),
          packageName,
          unitCount: Number(unitCount || 0),
        };
      })
    : [];

  // Resolve final assignments per floor
  function getAssignments(s: MappingSuggestion): FloorAssignment[] {
    if (s.assignments && s.assignments.length > 0) return s.assignments;
    if (s.packageName) return [{ packageName: s.packageName, unitCount: s.unitCount || 0 }];
    return [];
  }

  const totalRooms = suggestions.reduce(
    (sum, s) => sum + getAssignments(s).reduce((a, b) => a + (b.unitCount || 0), 0),
    0
  );

  // ── Flat list mode (1-2 floors) ──
  if (suggestions.length < REVIEW_THRESHOLD) {
    return (
      <FlatSuggestionView
        suggestions={suggestions}
        totalRooms={totalRooms}
        getAssignments={getAssignments}
        onSendMessage={onSendMessage}
      />
    );
  }

  // ── Floor-by-floor review mode (3+ floors) ──
  return (
    <FloorByFloorReview
      suggestions={suggestions}
      totalRooms={totalRooms}
      getAssignments={getAssignments}
      onSendMessage={onSendMessage}
    />
  );
}

// ════════════════════════════════════════
//  FLAT VIEW — simple inline (1-2 floors)
// ════════════════════════════════════════

function FlatSuggestionView({
  suggestions,
  totalRooms,
  getAssignments,
  onSendMessage,
}: {
  suggestions: MappingSuggestion[];
  totalRooms: number;
  getAssignments: (s: MappingSuggestion) => FloorAssignment[];
  onSendMessage?: (text: string) => void;
}) {
  return (
    <div className="border border-border border-l-2 border-l-accent/30 bg-bg-surface rounded-[var(--radius-card)] px-4 py-3.5 my-2">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-accent-light" />
        <span className="text-xs font-semibold text-content">Suggested Mapping</span>
        <span className="text-xs text-content-tertiary ml-auto">
          {suggestions.length} floor{suggestions.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-1.5 mb-3">
        {suggestions.map((s) => (
          <FloorAssignmentRow
            key={s.floorIndex}
            suggestion={s}
            assignments={getAssignments(s)}
          />
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t border-border">
        <button
          onClick={() => {
            const summary = suggestions
              .map((s) => {
                const parts = getAssignments(s)
                  .map((a) => `${a.unitCount} room${a.unitCount !== 1 ? "s" : ""} → ${a.packageName}`)
                  .join(", ");
                return `${s.floorLabel}: ${parts}`;
              })
              .join("; ");
            onSendMessage?.(`Apply this mapping: ${summary}`);
          }}
          className={cn(
            "flex-1 px-3 py-2.5 rounded-[var(--radius-button)] text-[13px] font-semibold",
            "bg-accent/10 text-accent-lighter border border-accent/30",
            "hover:bg-accent/20 active:scale-95 transition-all"
          )}
        >
          Apply mapping for {totalRooms} room{totalRooms !== 1 ? "s" : ""} →
        </button>
        <button
          onClick={() => onSendMessage?.("I want to map floors differently")}
          className="px-3 py-1.5 rounded-[var(--radius-button)] text-xs font-medium text-content-secondary border border-border hover:bg-bg-elevated active:scale-95 transition-all"
        >
          Map differently
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
//  FLOOR-BY-FLOOR REVIEW — FloorChipBar (3+)
// ════════════════════════════════════════════

function FloorByFloorReview({
  suggestions,
  totalRooms,
  getAssignments,
  onSendMessage,
}: {
  suggestions: MappingSuggestion[];
  totalRooms: number;
  getAssignments: (s: MappingSuggestion) => FloorAssignment[];
  onSendMessage?: (text: string) => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [decisions, setDecisions] = useState<Record<number, "accepted" | "modified">>({});
  const [submitted, setSubmitted] = useState(false);

  const total = suggestions.length;
  const allReviewed = Object.keys(decisions).length === total;
  const acceptedCount = Object.values(decisions).filter((d) => d === "accepted").length;
  const current = suggestions[selectedIdx];
  const currentDecision = decisions[selectedIdx];

  function acceptFloor() {
    setDecisions((prev) => ({ ...prev, [selectedIdx]: "accepted" }));
    // Auto-advance to next unreviewed
    for (let i = 1; i <= total; i++) {
      const nextIdx = (selectedIdx + i) % total;
      if (!decisions[nextIdx]) {
        setSelectedIdx(nextIdx);
        return;
      }
    }
  }

  function modifyFloor() {
    setDecisions((prev) => ({ ...prev, [selectedIdx]: "modified" }));
    const s = current;
    const parts = getAssignments(s)
      .map((a) => `${a.unitCount} → ${a.packageName}`)
      .join(", ");
    onSendMessage?.(`I want to change mapping for ${s.floorLabel} (currently: ${parts})`);
  }

  function handleFinalSubmit() {
    if (submitted) return;
    setSubmitted(true);
    const acceptedFloors = suggestions.filter((_, i) => decisions[i] === "accepted");
    const summary = acceptedFloors
      .map((s) => {
        const parts = getAssignments(s)
          .map((a) => `${a.unitCount} room${a.unitCount !== 1 ? "s" : ""} → ${a.packageName}`)
          .join(", ");
        return `${s.floorLabel}: ${parts}`;
      })
      .join("; ");
    onSendMessage?.(`Apply this mapping: ${summary}`);
  }

  return (
    <div className="border border-border border-l-2 border-l-accent/30 bg-bg-surface rounded-[var(--radius-card)] px-4 py-3.5 my-2">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-accent-light" />
        <span className="text-xs font-semibold text-content">Suggested Mapping</span>
        <span className="text-xs text-content-tertiary ml-auto">
          {Object.keys(decisions).length}/{total} reviewed
        </span>
      </div>

      {/* ── FloorChipBar with status ── */}
      <div className="mb-3">
        <FloorChipBar
          floors={suggestions.map((s, i) => ({
            index: i,
            label: s.floorLabel,
            status: decisions[i] === "accepted"
              ? "done"
              : decisions[i] === "modified"
                ? "done"
                : i === selectedIdx
                  ? "active"
                  : "pending",
          }))}
          selected={selectedIdx}
          onSelect={setSelectedIdx}
        />
      </div>

      {/* ── Current floor detail ── */}
      {!allReviewed && current && (
        <div className="mb-3">
          <FloorAssignmentRow
            suggestion={current}
            assignments={getAssignments(current)}
          />

          {/* Per-floor actions */}
          {!currentDecision && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={acceptFloor}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-[var(--radius-button)] text-xs font-semibold",
                  "bg-accent/10 text-accent-lighter border border-accent/30",
                  "hover:bg-accent/20 active:scale-95 transition-all"
                )}
              >
                <Check className="w-3 h-3" />
                Accept {current.floorLabel}
              </button>
              <button
                onClick={modifyFloor}
                className="px-3 py-2 rounded-[var(--radius-button)] text-xs font-medium text-content-secondary border border-border hover:bg-bg-elevated active:scale-95 transition-all"
              >
                Modify
              </button>
            </div>
          )}

          {currentDecision && (
            <p className={cn(
              "text-xs font-medium mt-2",
              currentDecision === "accepted" ? "text-success" : "text-accent-light"
            )}>
              {currentDecision === "accepted" ? "Accepted" : "Modified — waiting for update"}
            </p>
          )}
        </div>
      )}

      {/* ── Final submit after all reviewed ── */}
      {allReviewed && !submitted && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-content-secondary mb-2">
            {acceptedCount} of {total} floors accepted
          </p>
          <button
            onClick={handleFinalSubmit}
            className={cn(
              "w-full px-3 py-2.5 rounded-[var(--radius-button)] text-[13px] font-semibold",
              "bg-accent/10 text-accent-lighter border border-accent/30",
              "hover:bg-accent/20 active:scale-95 transition-all"
            )}
          >
            Apply mapping for {totalRooms} room{totalRooms !== 1 ? "s" : ""} →
          </button>
        </div>
      )}

      {submitted && (
        <p className="text-xs text-success font-medium">Mapping applied</p>
      )}
    </div>
  );
}

// ── Shared floor assignment row ──

function FloorAssignmentRow({
  suggestion,
  assignments,
}: {
  suggestion: MappingSuggestion;
  assignments: FloorAssignment[];
}) {
  const floorTotal = assignments.reduce((sum, a) => sum + (a.unitCount || 0), 0);
  const isMultiPackage = assignments.length > 1;

  return (
    <div className="px-3 py-2 rounded-[var(--radius-button)] bg-bg-elevated border border-border">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-content font-medium">{suggestion.floorLabel}</p>
        <p className="text-xs text-content-tertiary">
          {floorTotal} room{floorTotal !== 1 ? "s" : ""}
        </p>
      </div>

      <div className={cn("space-y-1", isMultiPackage && "pl-2 border-l border-border/50")}>
        {assignments.map((a, ai) => (
          <div key={ai} className="flex items-center gap-2">
            <span className="text-xs text-content-tertiary">
              {a.unitCount} room{a.unitCount !== 1 ? "s" : ""}
            </span>
            <ArrowRight className="w-2.5 h-2.5 text-content-tertiary flex-shrink-0" />
            <span className="text-xs text-accent-lighter/80 font-medium">{a.packageName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
