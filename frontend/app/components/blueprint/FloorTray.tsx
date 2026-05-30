"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { FloorComposition, type CompositionSegment } from "./FloorComposition";

/**
 * FloorTray — one floor in the FloorLedger.
 *
 * Collapsed: name + status + the FloorComposition bar (a calm one-line glance).
 * Expanded: + legend + room cells, and (when configured) a "name range" line and
 * an "Open floor" affordance. Handles the §9 empty-vs-filled states: an empty
 * floor shows no bar, a filled floor shows its mix, a mapped floor says so.
 *
 * The header is a real <button> (keyboard-operable, aria-expanded); the
 * "Open floor" control lives OUTSIDE it (no nested buttons).
 */

export interface LedgerFloor {
  id: string | number;
  name: string;
  sub?: string; // "top", "reception"
  rooms: number;
  segments: CompositionSegment[];
  /** e.g. "301–316" — shown when expanded */
  nameRange?: string;
  /** mapping-stage status; when true the row reads "✓ mapped" */
  mapped?: boolean;
}

interface FloorTrayProps {
  floor: LedgerFloor;
  expanded: boolean;
  onToggle: () => void;
  onOpen?: () => void;
}

export function FloorTray({ floor, expanded, onToggle, onOpen }: FloorTrayProps) {
  // `rooms` and `segments` are assumed consistent (segments sum to rooms) — that
  // invariant is enforced upstream by the emit_ui adapter, not re-checked here.
  const empty = floor.rooms === 0;
  const status = empty
    ? "empty"
    : floor.mapped
      ? `${floor.rooms} · ✓ mapped`
      : `${floor.rooms} room${floor.rooms !== 1 ? "s" : ""}`;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-bg-surface transition-colors",
        expanded ? "border-border-accent" : "border-border"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left px-4 pt-3.5 pb-3 cursor-pointer"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-content truncate">
            {floor.name}
            {floor.sub && <span className="text-content-tertiary font-normal"> · {floor.sub}</span>}
          </p>
          <span className="flex items-center gap-1.5 shrink-0">
            <span
              className={cn(
                "text-xs font-mono",
                empty ? "text-content-tertiary" : expanded ? "text-accent-lighter" : "text-content-secondary"
              )}
            >
              {status}
            </span>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-content-tertiary transition-transform",
                expanded && "rotate-180"
              )}
              aria-hidden="true"
            />
          </span>
        </div>

        {!empty && (
          <div className="mt-2.5">
            <FloorComposition
              segments={floor.segments}
              showLegend={expanded}
              showCells={expanded}
            />
          </div>
        )}
        {empty && expanded && (
          <p className="mt-2 text-[11px] text-content-tertiary">
            No rooms yet — tell me how many and what types.
          </p>
        )}
      </button>

      {expanded && !empty && (floor.nameRange || onOpen) && (
        <div className="px-4 pb-3.5 flex items-center justify-between gap-3">
          {floor.nameRange ? (
            <span className="text-[11px] font-mono text-content-tertiary">
              named {floor.nameRange}
            </span>
          ) : (
            <span />
          )}
          {onOpen && (
            <button
              type="button"
              onClick={onOpen}
              className="text-xs font-medium text-accent-lighter hover:underline cursor-pointer"
            >
              Open floor →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
