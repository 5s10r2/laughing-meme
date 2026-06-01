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
  /** short type tag shown beside the label (e.g. "Double") to disambiguate on mixed floors */
  typeTag?: string;
  ariaLabel?: string;
  /** dot colour; null/undefined renders a hollow ring (unpriced / no type) */
  dotColor?: string | null;
  /** selectable chips pass a boolean; plain chips omit it (no aria-pressed) */
  selected?: boolean;
  /** unpriced styling — bolder surface, since these are the rooms still to act on */
  dashed?: boolean;
  onClick?: () => void;
}

export function RoomChip({ label, typeTag, ariaLabel, dotColor, selected, dashed, onClick }: RoomChipProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={typeof selected === "boolean" ? selected : undefined}
      onClick={onClick}
      className={cn(
        // min-h 44px: a comfortable one-handed mobile tap target
        "inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-lg text-sm font-mono font-medium",
        "cursor-pointer transition-colors active:scale-95",
        selected
          ? "bg-accent/10 border border-accent text-content ring-1 ring-accent/20"
          : dashed
            ? // unpriced = the work: a solid, full-contrast surface that reads as "tap me"
              // (inverted from the old faint dashed treatment — the to-do should be loudest)
              "bg-bg-elevated border border-border-strong text-content hover:bg-bg-subtle"
            : // priced = done: quiet down to a calm surface + a colour dot
              "bg-bg-surface border border-border text-content-secondary hover:border-border-strong"
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
      {typeTag && (
        <span className="text-[10px] font-sans font-normal text-content-tertiary">{typeTag}</span>
      )}
    </button>
  );
}
