"use client";

import { AlertTriangle } from "lucide-react";
import { RoomChip } from "./RoomChip";
import { cap, plural } from "./tokens";

/**
 * UnmappedWarning — the property-level safety net (design system §5.4 / §8).
 *
 * Rolls up rooms that aren't assigned to a package across floors, so nothing is
 * silently dropped before go-live. Calm, not alarming (warning amber, not error
 * red). Self-hides when there's nothing unmapped. View+intent: tapping a room or
 * the CTA sends an intent to Tarini.
 */

export interface UnmappedFloor {
  floorLabel: string;
  units: { id: string | number; name: string }[];
}

interface UnmappedWarningProps {
  floors: UnmappedFloor[];
  /** singular noun for the unit (room / flat / bed / unit); backend-projected */
  unitNoun?: string;
  onSendMessage?: (text: string) => void;
}

export function UnmappedWarning({ floors, unitNoun = "room", onSendMessage }: UnmappedWarningProps) {
  const withUnmapped = floors.filter((f) => f.units.length > 0);
  const total = withUnmapped.reduce((sum, f) => sum + f.units.length, 0);
  if (total === 0) return null; // all assigned → nothing to warn about

  return (
    <div role="status" className="rounded-2xl border border-warning/30 bg-warning-surface p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-content">
            {total} {plural(unitNoun, total)} still need a package
          </p>
          <p className="text-[11px] text-content-secondary mt-0.5">
            Assign these before going live — nothing is dropped.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        {withUnmapped.map((f) => (
          <div key={f.floorLabel}>
            <p className="text-[11px] text-content-tertiary font-medium mb-1.5">
              {f.floorLabel} ({f.units.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {f.units.map((u) => (
                <RoomChip
                  key={u.id}
                  label={u.name}
                  ariaLabel={`${cap(unitNoun)} ${u.name} on ${f.floorLabel}, unmapped`}
                  dotColor={null}
                  dashed
                  onClick={() => onSendMessage?.(`Assign ${unitNoun} ${u.name} on ${f.floorLabel}`)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          onSendMessage?.(`Help me assign the ${total} unmapped ${plural(unitNoun, total)}`)
        }
        className="mt-3.5 w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity active:scale-[0.99]"
      >
        Help me assign {total === 1 ? "it" : "them"} →
      </button>
    </div>
  );
}
