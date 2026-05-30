"use client";

import { useEffect, useRef, useState } from "react";
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
  onSendMessage?: (text: string) => void;
}

export function FloorLedger({ floors, activeId, onSendMessage }: FloorLedgerProps) {
  const [openId, setOpenId] = useState<string | number | null>(
    activeId ?? floors[0]?.id ?? null
  );
  const prevActiveId = useRef(activeId);

  // the floor whose full drill-down sheet is open (null = closed)
  const [detailId, setDetailId] = useState<string | number | null>(null);
  const detailFloor = detailId != null ? floors.find((f) => f.id === detailId) ?? null : null;

  // Reconcile the open floor with post-mount prop changes (this is an LLM-fed
  // surface): follow a changed `activeId`, and recover if the open floor was
  // removed — while respecting an explicit collapse-all (openId === null).
  useEffect(() => {
    if (activeId !== prevActiveId.current) {
      prevActiveId.current = activeId;
      if (activeId != null) {
        setOpenId(activeId);
        return;
      }
    }
    setOpenId((cur) =>
      cur !== null && !floors.some((f) => f.id === cur)
        ? (activeId ?? floors[0]?.id ?? null)
        : cur
    );
  }, [activeId, floors]);

  if (!floors.length) return null;

  return (
    // Self-scope .lp-theme: this ledger renders FloorComposition's categorical
    // colours (var(--t-single)…), which are defined ONLY under .lp-theme. Scoping
    // here keeps the component correct even if the shell theme isn't applied
    // (e.g. server/client experience flags diverge), matching BlueprintMapping.
    <div className="lp-theme flex flex-col gap-2">
      {floors.map((floor) => (
        <FloorTray
          key={floor.id}
          floor={floor}
          expanded={openId === floor.id}
          onToggle={() => setOpenId((prev) => (prev === floor.id ? null : floor.id))}
          onOpen={() => setDetailId(floor.id)}
        />
      ))}

      <FloorDetailSheet
        floor={detailFloor}
        open={detailFloor !== null}
        onClose={() => setDetailId(null)}
        onSendMessage={onSendMessage}
      />
    </div>
  );
}
