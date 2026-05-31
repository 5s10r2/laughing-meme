"use client";

import { useMemo } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { FloorComposition } from "./FloorComposition";
import { RoomChip } from "./RoomChip";
import { typeColor, cap, plural } from "./tokens";
import type { LedgerFloor, FloorUnit } from "./FloorTray";

/**
 * FloorDetailSheet — the §9 full floor drill-down.
 *
 * Opened from a FloorLedger row's "Open floor". Unlike the inline tray (which
 * caps cells at "+N"), this shows EVERY room, grouped and coloured by type, each
 * a tappable chip. It is a VIEW + INTENT surface: tapping a room sends an edit
 * intent to Tarini (rename / change type) rather than opening a bespoke editor —
 * the AI mutates the model via commands and the UI re-projects.
 *
 * BottomSheet portals to document.body (outside the page's .lp-theme), so we
 * re-establish the theme on the panel via its className.
 */

interface FloorDetailSheetProps {
  floor: LedgerFloor | null;
  open: boolean;
  /** singular noun for the unit (room / flat / bed / unit); backend-projected */
  unitNoun?: string;
  onClose: () => void;
  onSendMessage?: (text: string) => void;
}

export function FloorDetailSheet({ floor, open, unitNoun = "room", onClose, onSendMessage }: FloorDetailSheetProps) {
  const title = floor ? `${floor.name}${floor.sub ? ` · ${floor.sub}` : ""}` : undefined;
  return (
    <BottomSheet open={open} onClose={onClose} title={title} className="lp-theme">
      {floor && <FloorDetailBody floor={floor} unitNoun={unitNoun} onSendMessage={onSendMessage} />}
    </BottomSheet>
  );
}

function FloorDetailBody({
  floor,
  unitNoun = "room",
  onSendMessage,
}: {
  floor: LedgerFloor;
  unitNoun?: string;
  onSendMessage?: (text: string) => void;
}) {
  const units = floor.units ?? [];
  const empty = floor.rooms === 0;

  // group rooms by category, preserving first-seen order
  const groups = useMemo(() => {
    const map = new Map<string, FloorUnit[]>();
    for (const u of units) {
      const list = map.get(u.category) ?? [];
      list.push(u);
      map.set(u.category, list);
    }
    return [...map.entries()].map(([category, rooms]) => ({ category, rooms }));
  }, [units]);

  if (empty) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-content-secondary">No {plural(unitNoun, 2)} on this floor yet.</p>
        <button
          type="button"
          onClick={() => onSendMessage?.(`Add ${plural(unitNoun, 2)} to ${floor.name}`)}
          className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent text-white text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity"
        >
          Tell Tarini how many {plural(unitNoun, 2)}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* summary */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs font-mono text-content-secondary">
            {floor.rooms} {plural(unitNoun, floor.rooms)}
          </span>
          {floor.nameRange && (
            <span className="text-[11px] font-mono text-content-tertiary">named {floor.nameRange}</span>
          )}
        </div>
        <FloorComposition segments={floor.segments} showLegend />
      </div>

      {/* every room, grouped + coloured by type — tap to edit via Tarini */}
      {groups.length > 0 ? (
        <div className="flex flex-col gap-3">
          {groups.map(({ category, rooms }) => (
            <div key={category}>
              <p className="text-[11px] text-content-tertiary font-medium mb-1.5">
                {cap(category)} ({rooms.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {rooms.map((u) => (
                  <RoomChip
                    key={u.id}
                    label={u.name}
                    ariaLabel={`${cap(category)} ${unitNoun} ${u.name}`}
                    dotColor={typeColor(category)}
                    onClick={() => onSendMessage?.(`Edit ${unitNoun} ${u.name} on ${floor.name}`)}
                  />
                ))}
              </div>
            </div>
          ))}
          <p className="text-[11px] text-content-tertiary">Tap a {unitNoun} to rename it or change its type.</p>
        </div>
      ) : (
        // units counted but no per-unit list provided — keep the summary, prompt for detail
        <button
          type="button"
          onClick={() => onSendMessage?.(`Show me the ${plural(unitNoun, 2)} on ${floor.name}`)}
          className="text-xs font-medium text-accent hover:underline cursor-pointer self-start"
        >
          List the individual {plural(unitNoun, 2)} →
        </button>
      )}
    </div>
  );
}
