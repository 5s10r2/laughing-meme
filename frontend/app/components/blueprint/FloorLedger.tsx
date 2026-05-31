"use client";

import { useState } from "react";
import { FloorTray, type LedgerFloor } from "./FloorTray";
import { FloorDetailSheet } from "./FloorDetailSheet";

/** The ledger's public data contract (re-exported so consumers compose with one unit). */
export type { LedgerFloor, FloorUnit } from "./FloorTray";

/**
 * FloorLedger — the Living Blueprint working view (design system §4.2).
 *
 * A vertical list of FloorTrays: each floor is one calm bar row; tapping a row
 * expands it (single-open accordion) to reveal its legend + room cells. The
 * active floor opens by default and follows `activeId` when the parent moves it.
 * Floor identity is stable (by id), so this stays the editable per-floor surface
 * that pairs with the massing portrait.
 *
 * Props are TRUSTED here: validation/coercion of LLM data (finite counts,
 * segments summing to `rooms`, unique ids) is the emit_ui adapter's job at the
 * boundary, unlike MassingModel which coerces inline. This keeps the ledger a
 * pure view. Room-density is handled by FloorComposition's "+N" cap; floor-count
 * density by compact rows that scroll.
 */

interface FloorLedgerProps {
  floors: LedgerFloor[];
  /** which floor is expanded by default, and the floor the parent is directing attention to */
  activeId?: string | number;
  /** singular noun for the unit (room / flat / bed / unit); backend-projected */
  unitNoun?: string;
  onSendMessage?: (text: string) => void;
}

export function FloorLedger({ floors, activeId, unitNoun = "room", onSendMessage }: FloorLedgerProps) {
  const [openId, setOpenId] = useState<string | number | null>(
    activeId ?? floors[0]?.id ?? null
  );
  const [prevActiveId, setPrevActiveId] = useState(activeId);

  // the floor whose full drill-down sheet is open (null = closed)
  const [detailId, setDetailId] = useState<string | number | null>(null);
  const detailFloor = detailId != null ? floors.find((f) => f.id === detailId) ?? null : null;

  // Follow a changed `activeId` (this is an LLM-fed surface): latch it as the
  // open floor when the parent moves attention. Adjusting state during render —
  // the React-recommended replacement for a reconciling effect — converges
  // because prevActiveId catches up in the same pass.
  if (activeId !== prevActiveId) {
    setPrevActiveId(activeId);
    if (activeId != null) setOpenId(activeId);
  }

  if (!floors.length) return null;

  // Recover if the open floor was removed, derived during render — while
  // respecting an explicit collapse-all (openId === null stays closed).
  const effectiveOpenId =
    openId !== null && !floors.some((f) => f.id === openId)
      ? (activeId ?? floors[0]?.id ?? null)
      : openId;

  return (
    // Self-scope .lp-theme: this ledger renders FloorComposition's categorical
    // colours (var(--t-single)…), which are defined ONLY under .lp-theme. Scoping
    // here keeps the component correct even if the shell theme isn't applied
    // (e.g. server/client experience flags diverge), matching BlueprintMapping.
    <div className="lp-theme flex flex-col gap-2">
      {floors.map((floor) => (
        // data-floor-id: a scroll/flash anchor for the massing-model floor tap.
        <div key={floor.id} data-floor-id={String(floor.id)}>
          <FloorTray
            floor={floor}
            expanded={effectiveOpenId === floor.id}
            unitNoun={unitNoun}
            onToggle={() => setOpenId(effectiveOpenId === floor.id ? null : floor.id)}
            onOpen={() => setDetailId(floor.id)}
          />
        </div>
      ))}

      <FloorDetailSheet
        floor={detailFloor}
        open={detailFloor !== null}
        unitNoun={unitNoun}
        onClose={() => setDetailId(null)}
        onSendMessage={onSendMessage}
      />
    </div>
  );
}
