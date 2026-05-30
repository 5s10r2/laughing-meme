"use client";

import { cn } from "../../lib/cn";

/**
 * RoomChip — a single room as a chip: a colour dot + the room name on a light
 * surface with dark text (so the label always passes contrast; the categorical
 * colour rides only on the small decorative dot).
 *
 * Shared by the floor drill-down (plain, intent-triggering chips) and the
 * mapping row (selectable chips, mapped/unmapped states). One pattern, one place.
 */

interface RoomChipProps {
  label: string;
  ariaLabel?: string;
  /** dot colour; null/undefined renders a hollow ring (unmapped / no type) */
  dotColor?: string | null;
  /** selectable chips pass a boolean; plain chips omit it (no aria-pressed) */
  selected?: boolean;
  /** unmapped styling — dashed border, muted text */
  dashed?: boolean;
  onClick?: () => void;
}

export function RoomChip({ label, ariaLabel, dotColor, selected, dashed, onClick }: RoomChipProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={typeof selected === "boolean" ? selected : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium",
        "cursor-pointer transition-colors active:scale-95",
        selected
          ? "bg-accent/10 border border-accent text-content ring-1 ring-accent/20"
          : dashed
            ? // unmapped: dashed border + hollow dot signal the state; text stays
              // full-contrast (text-content) since these are the rooms to act on
              "bg-bg-elevated border border-dashed border-border-strong text-content hover:border-border-strong"
            : "bg-bg-elevated border border-border text-content hover:border-border-strong"
      )}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={
          dotColor
            ? { background: dotColor }
            : { boxShadow: "inset 0 0 0 1px var(--border-strong)" }
        }
        aria-hidden="true"
      />
      {label}
    </button>
  );
}
