"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../../lib/cn";
import { FloorChipBar } from "../../ui/FloorChipBar";
import { humanizeCategory } from "../../../lib/property-utils";

interface UnitName {
  name: string;
  category?: string;
}

interface FloorNaming {
  floor: string;
  names: string[];
  units?: UnitName[];
}

interface NamingPreviewProps {
  pattern?: string;
  patternDescription?: string;
  preview: FloorNaming[];
  onSendMessage?: (text: string) => void;
}

const COLLAPSE_THRESHOLD = 12;

/** Threshold at which we switch from inline to FloorChipBar navigation */
const TABBED_THRESHOLD = 3;

function FloorNameGroup({
  floor,
  standalone,
}: {
  floor: FloorNaming;
  /** true when showing without FloorChipBar (1-2 floors) — shows floor label */
  standalone: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const units: UnitName[] = floor.units && floor.units.length > 0
    ? floor.units
    : (floor.names || []).map((n) => ({ name: n }));

  const hasCategories = units.some((u) => u.category);
  const groups: { category: string; label: string; names: string[] }[] = [];

  if (hasCategories) {
    const groupMap = new Map<string, string[]>();
    for (const u of units) {
      const cat = u.category || "other";
      if (!groupMap.has(cat)) groupMap.set(cat, []);
      groupMap.get(cat)!.push(u.name);
    }
    for (const [cat, names] of groupMap) {
      groups.push({ category: cat, label: humanizeCategory(cat), names });
    }
  }

  const totalNames = units.length;
  const shouldCollapse = totalNames > COLLAPSE_THRESHOLD;
  const showExpanded = !shouldCollapse || expanded;

  function renderNameChips(names: string[], limit?: number) {
    const displayNames = limit ? names.slice(0, limit) : names;
    const remaining = limit ? names.length - limit : 0;
    return (
      <>
        {displayNames.map((name) => (
          <span
            key={name}
            className="px-2.5 py-1 rounded bg-zinc-800/80 text-[11px] font-medium text-zinc-300 font-mono"
          >
            {name}
          </span>
        ))}
        {remaining > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="px-2 py-1 text-[11px] text-zinc-500 hover:text-amber-400 transition-colors"
          >
            +{remaining} more
          </button>
        )}
      </>
    );
  }

  return (
    <div>
      {/* Only show floor label in standalone (inline) mode */}
      {standalone && (
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-zinc-500">{floor.floor}</p>
          {shouldCollapse && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-0.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>Collapse</span>
                </>
              ) : (
                <>
                  <span>{totalNames} names</span>
                  <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Collapse toggle for tabbed mode (no standalone label) */}
      {!standalone && shouldCollapse && (
        <div className="flex items-center justify-end mb-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-0.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                <span>Collapse</span>
              </>
            ) : (
              <>
                <span>{totalNames} names</span>
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Grouped view (multiple categories) */}
      {hasCategories && groups.length > 1 ? (
        <div className="space-y-2">
          {groups.map((group) => (
            <div key={group.category}>
              <p className="text-[11px] text-zinc-600 mb-1">
                {group.label} ({group.names.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {showExpanded
                  ? renderNameChips(group.names)
                  : renderNameChips(group.names, Math.min(6, Math.ceil(COLLAPSE_THRESHOLD * (group.names.length / totalNames))))
                }
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {showExpanded
            ? renderNameChips(units.map((u) => u.name))
            : renderNameChips(units.map((u) => u.name), 6)
          }
        </div>
      )}
    </div>
  );
}

export function NamingPreview({
  patternDescription: rawPatternDescription,
  preview: rawPreview,
  onSendMessage,
  ...rest
}: NamingPreviewProps & Record<string, unknown>) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customPattern, setCustomPattern] = useState("");
  const [selectedFloorIdx, setSelectedFloorIdx] = useState(0);

  // Defensive: handle missing/malformed props from Claude
  const patternDescription = rawPatternDescription || (rest.pattern_description as string) || (rest.pattern as string) || "";

  const rawList = Array.isArray(rawPreview)
    ? rawPreview
    : Array.isArray((rest as Record<string, unknown>).floors)
      ? ((rest as Record<string, unknown>).floors as FloorNaming[])
      : Array.isArray((rest as Record<string, unknown>).names)
        ? ((rest as Record<string, unknown>).names as FloorNaming[])
        : [];

  const preview: FloorNaming[] = (rawList as unknown[]).map((raw: unknown, i: number) => {
    const f = raw as Record<string, unknown>;
    const floorLabel = (f.floor || f.floor_label || f.floorLabel || f.label || `Floor ${i}`) as string;
    const rawNames = (Array.isArray(f.names) && f.names.length > 0) ? f.names
      : (Array.isArray(f.room_names) && f.room_names.length > 0) ? f.room_names
      : Array.isArray(f.units) ? f.units
      : Array.isArray(f.rooms) ? f.rooms
      : [];

    const parsedUnits: UnitName[] = rawNames.map((n: unknown) => {
      if (typeof n === "string") return { name: n };
      if (typeof n === "number") return { name: String(n) };
      if (n && typeof n === "object") {
        const obj = n as Record<string, unknown>;
        return {
          name: String(obj.name || obj.label || obj.unit_name || obj.room_name || obj.id || ""),
          category: (obj.category || obj.type || obj.unit_type) as string | undefined,
        };
      }
      return { name: String(n) };
    });

    return {
      floor: floorLabel,
      names: parsedUnits.map((u) => u.name),
      units: parsedUnits,
    };
  });

  if (!preview.length) return null;

  const isTabbed = preview.length >= TABBED_THRESHOLD;
  const selectedFloor = preview[selectedFloorIdx] || preview[0];
  const firstFloor = preview[0]?.floor || "this floor";

  return (
    <div className="border border-zinc-800 border-l-2 border-l-amber-500/30 bg-zinc-900/40 rounded-xl px-3.5 py-3 my-2">
      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">
        How your rooms will be named
      </p>
      {patternDescription && (
        <p className="text-xs text-zinc-400 mb-2.5">{patternDescription}</p>
      )}

      {/* ── Tabbed mode (3+ floors): FloorChipBar + single floor view ── */}
      {isTabbed && (
        <>
          <div className="mb-2.5">
            <FloorChipBar
              floors={preview.map((f, i) => ({
                index: i,
                label: f.floor,
              }))}
              selected={selectedFloorIdx}
              onSelect={setSelectedFloorIdx}
            />
          </div>

          <FloorNameGroup floor={selectedFloor} standalone={false} />
        </>
      )}

      {/* ── Inline mode (1-2 floors): show all ── */}
      {!isTabbed && (
        <div className="space-y-2.5">
          {preview.map((floor) => (
            <FloorNameGroup key={floor.floor} floor={floor} standalone />
          ))}
        </div>
      )}

      {/* Custom pattern input */}
      {showCustomInput && (
        <div className="mb-3 pt-2 border-t border-zinc-800 mt-3">
          <label className="text-xs text-zinc-500 mb-1 block">
            Enter your naming pattern (e.g., Room-A, Room-B):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customPattern}
              onChange={(e) => setCustomPattern(e.target.value)}
              placeholder="e.g. Room-101, Room-102"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
              autoFocus
            />
            <button
              onClick={() => {
                if (customPattern.trim()) {
                  onSendMessage?.(`Use naming pattern: ${customPattern.trim()}`);
                  setShowCustomInput(false);
                }
              }}
              disabled={!customPattern.trim()}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium",
                "bg-amber-500/15 text-amber-300 border border-amber-500/25",
                "hover:bg-amber-500/25 active:scale-95 transition-all",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              Use this pattern →
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-zinc-800 mt-3">
        <button
          onClick={() =>
            onSendMessage?.(
              `Use the naming pattern: ${patternDescription || "default"} for ${firstFloor}`
            )
          }
          className={cn(
            "flex-1 px-3 py-2.5 rounded-lg text-[13px] font-semibold",
            "bg-amber-500/20 text-amber-300 border border-amber-500/25",
            "hover:bg-amber-500/25 active:scale-95 transition-all"
          )}
        >
          Use these names →
        </button>
        {!showCustomInput && (
          <button
            onClick={() => setShowCustomInput(true)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium",
              "text-zinc-400 border border-zinc-700",
              "hover:bg-zinc-800 active:scale-95 transition-all"
            )}
          >
            I&apos;ll type my own names
          </button>
        )}
      </div>
    </div>
  );
}
