"use client";

import { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { BTN_PRIMARY } from "../ui/primitives";
import { cap } from "./tokens";
import type { FloorUnit } from "./FloorTray";

/**
 * UnitEditSheet — direct edits on a single unit: rename, or take it off the market.
 * Emits RenameSpace / MarkUnavailable through the Blueprint command layer (no LLM), reusing
 * the shared toast + transcript-note. Change-sharing and re-activate are intentionally not
 * here yet (sharing needs a projection + capacity re-derivation; re-activate needs the
 * unavailable units surfaced — both follow-ups). For now: the two an operator reaches for most.
 */

interface UnitEditSheetProps {
  unit: FloorUnit | null;
  unitNoun?: string;
  open: boolean;
  onClose: () => void;
  onApply: (commands: Record<string, unknown>[], summary: string) => void;
}

export function UnitEditSheet({ unit, unitNoun = "unit", open, onClose, onApply }: UnitEditSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={unit ? `${cap(unitNoun)} ${unit.name}` : undefined}
      className="lp-theme"
    >
      {unit && <EditBody key={unit.id} unit={unit} unitNoun={unitNoun} onClose={onClose} onApply={onApply} />}
    </BottomSheet>
  );
}

function EditBody({
  unit,
  unitNoun,
  onClose,
  onApply,
}: {
  unit: FloorUnit;
  unitNoun: string;
  onClose: () => void;
  onApply: UnitEditSheetProps["onApply"];
}) {
  const [name, setName] = useState(unit.name);

  function saveName() {
    const next = name.trim();
    if (next && next !== unit.name) {
      onApply([{ op: "RenameSpace", space_id: unit.id, label: next }], `Renamed ${unit.name} → ${next}`);
    }
    onClose();
  }

  function markUnavailable() {
    onApply(
      [{ op: "MarkUnavailable", space_ids: [unit.id], unavailable: true }],
      `Marked ${unitNoun} ${unit.name} unavailable`
    );
    onClose();
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-content-tertiary uppercase tracking-wide">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && saveName()}
          className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-content focus:border-border-accent focus:outline-none"
        />
      </label>

      <button type="button" className={BTN_PRIMARY} onClick={saveName}>
        Save name
      </button>

      <div className="border-t border-border pt-3">
        <button
          type="button"
          onClick={markUnavailable}
          className="w-full rounded-xl border border-warning/40 bg-warning-surface py-2.5 text-sm font-medium text-warning transition-opacity hover:opacity-90 active:scale-[0.99]"
        >
          Mark unavailable · take off the market
        </button>
        <p className="mt-1.5 text-[11px] text-content-tertiary">
          Hides it from the listing. Tell Tarini to make it available again later.
        </p>
      </div>
    </div>
  );
}
