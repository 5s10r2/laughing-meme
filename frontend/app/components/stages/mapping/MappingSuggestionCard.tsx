"use client";

import { useState } from "react";
import { Sparkles, ArrowRight, Check } from "lucide-react";
import { cn } from "../../../lib/cn";
import {
  CARD, ICON_SM, BTN_PRIMARY, BTN_SECONDARY,
} from "../../ui/primitives";
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
//  FLAT VIEW -- simple inline (1-2 floors)
// ════════════════════════════════════════

function FlatSuggestionView({
  suggestions,
  getAssignments,
  onSendMessage,
}: {
  suggestions: MappingSuggestion[];
  getAssignments: (s: MappingSuggestion) => FloorAssignment[];
  onSendMessage?: (text: string) => void;
}) {
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-3.5 h-3.5 text-accent-lighter" />
        <p className="text-xs font-medium text-content-tertiary">Suggested mapping</p>
      </div>
      <p className="text-[11px] text-content-tertiary/70 mb-4">Assign rooms to packages</p>

      <div className="space-y-2 mb-5">
        {suggestions.map((s) => (
          <FloorAssignmentRow
            key={s.floorIndex}
            suggestion={s}
            assignments={getAssignments(s)}
          />
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onSendMessage?.("I want to map floors differently")}
          className={cn(BTN_SECONDARY, "flex-1")}
        >
          Adjust
        </button>
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
          className={cn(BTN_PRIMARY, "flex-1")}
        >
          <span className="inline-flex items-center gap-2">
            Apply <ArrowRight className="w-4 h-4" />
          </span>
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
//  FLOOR-BY-FLOOR REVIEW -- FloorChipBar (3+)
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
  const modifiedCount = Object.values(decisions).filter((d) => d === "modified").length;
  const current = suggestions[selectedIdx];
  const currentDecision = decisions[selectedIdx];

  // Rooms in the floors actually being applied (accepted only) — modified floors
  // are handled by a separate agent round-trip, so they are intentionally excluded.
  const acceptedRooms = suggestions
    .filter((_, i) => decisions[i] === "accepted")
    .reduce((sum, s) => sum + getAssignments(s).reduce((a, b) => a + (b.unitCount || 0), 0), 0);

  function acceptFloor() {
    // Compute next decisions synchronously so the advance loop sees the updated
    // state — setDecisions is async and the closure would see the stale value.
    const next = { ...decisions, [selectedIdx]: "accepted" as const };
    setDecisions(next);
    for (let i = 1; i <= total; i++) {
      const nextIdx = (selectedIdx + i) % total;
      if (!next[nextIdx]) {
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
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-3.5 h-3.5 text-accent-lighter" />
        <p className="text-xs font-medium text-content-tertiary">Suggested mapping</p>
      </div>
      <p className="text-[11px] text-content-tertiary/70 mb-4">
        {Object.keys(decisions).length}/{total} reviewed
      </p>

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
            <div className="flex gap-3 mt-4">
              <button
                onClick={modifyFloor}
                className={cn(BTN_SECONDARY, "flex-1")}
              >
                Modify
              </button>
              <button
                onClick={acceptFloor}
                className={cn(BTN_PRIMARY, "flex-1")}
              >
                <span className="inline-flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Accept {current.floorLabel}
                </span>
              </button>
            </div>
          )}

          {currentDecision && (
            <div className="flex items-center gap-2 mt-3">
              <div className={cn(ICON_SM, "bg-success/12")}>
                <Check className="w-3 h-3 text-success" />
              </div>
              <span className={cn(
                "text-sm font-medium",
                currentDecision === "accepted" ? "text-success" : "text-accent-light"
              )}>
                {currentDecision === "accepted" ? "Accepted" : "Modified -- waiting for update"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Final submit after all reviewed ── */}
      {allReviewed && !submitted && (
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-content-secondary mb-3">
            {acceptedCount} of {total} floors accepted
            {modifiedCount > 0 && ` · ${modifiedCount} being updated separately`}
          </p>
          {acceptedCount > 0 ? (
            <button onClick={handleFinalSubmit} className={BTN_PRIMARY}>
              <span className="inline-flex items-center gap-2">
                Apply mapping for {acceptedRooms} room{acceptedRooms !== 1 ? "s" : ""}
                <ArrowRight className="w-4 h-4" />
              </span>
            </button>
          ) : (
            <p className="text-xs text-content-tertiary">
              Waiting for updated suggestions on the floors you asked to change…
            </p>
          )}
        </div>
      )}

      {submitted && (
        <div className="flex items-center gap-2">
          <div className={cn(ICON_SM, "bg-success/12")}>
            <Check className="w-3 h-3 text-success" />
          </div>
          <span className="text-sm text-success font-medium">Mapping applied</span>
        </div>
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

  return (
    <div className="flex items-center gap-3 py-3.5 px-4 rounded-xl bg-bg-elevated">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-content font-medium">{suggestion.floorLabel}</p>
        <p className="text-[11px] text-content-tertiary mt-0.5">
          {floorTotal} room{floorTotal !== 1 ? "s" : ""}
        </p>
      </div>
      <div className={cn(ICON_SM, "bg-bg-subtle")}>
        <ArrowRight className="w-3 h-3 text-content-tertiary" />
      </div>
      <div className="flex-1 min-w-0 text-right">
        {assignments.map((a, ai) => (
          <p key={ai} className="text-sm text-content font-medium">{a.packageName}</p>
        ))}
      </div>
    </div>
  );
}
