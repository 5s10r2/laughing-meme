"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Check, Sparkles } from "lucide-react";
import { cn } from "../../../lib/cn";
import { FloorChipBar } from "../../ui/FloorChipBar";
import { humanizeCategory } from "../../../lib/property-utils";
import { CARD, BTN_PRIMARY, BTN_GHOST } from "../../ui/primitives";

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
  /** true when showing without FloorChipBar (1-2 floors) -- shows floor label */
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
            className="px-3 py-2 rounded-lg bg-bg-elevated border border-border text-sm text-content font-mono font-medium"
          >
            {name}
          </span>
        ))}
        {remaining > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="px-2 py-1 text-[11px] text-content-tertiary hover:text-accent-lighter transition-colors cursor-pointer"
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
          <p className="text-xs text-content-tertiary">{floor.floor}</p>
          {shouldCollapse && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-0.5 text-[11px] text-content-tertiary hover:text-content-secondary transition-colors cursor-pointer"
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
            className="flex items-center gap-0.5 text-[11px] text-content-tertiary hover:text-content-secondary transition-colors cursor-pointer"
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
              <p className="text-[11px] text-content-tertiary mb-1">
                {group.label} ({group.names.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {showExpanded
                  ? renderNameChips(group.names)
                  : renderNameChips(group.names, Math.min(6, Math.ceil(COLLAPSE_THRESHOLD * (group.names.length / totalNames))))
                }
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
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
  patternDescription = "",
  preview: rawPreview,
  onSendMessage,
}: NamingPreviewProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customPattern, setCustomPattern] = useState("");
  const [selectedFloorIdx, setSelectedFloorIdx] = useState(0);

  const rawList = Array.isArray(rawPreview) ? rawPreview : [];

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
    <div className={cn(CARD, "my-2")}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-3.5 h-3.5 text-accent-lighter" />
        <p className="text-xs font-medium text-content-tertiary">Room names</p>
      </div>
      {patternDescription && (
        <p className="text-[11px] text-content-tertiary/70 mb-4">{patternDescription}</p>
      )}

      {/* ── Tabbed mode (3+ floors): FloorChipBar + single floor view ── */}
      {isTabbed && (
        <>
          <div className="mb-3">
            <FloorChipBar
              floors={preview.map((f, i) => ({
                index: i,
                label: f.floor,
              }))}
              selected={selectedFloorIdx}
              onSelect={setSelectedFloorIdx}
            />
          </div>

          <div className="mb-4">
            <FloorNameGroup floor={selectedFloor} standalone={false} />
          </div>
        </>
      )}

      {/* ── Inline mode (1-2 floors): show all ── */}
      {!isTabbed && (
        <div className="space-y-2.5 mb-4">
          {preview.map((floor) => (
            <FloorNameGroup key={floor.floor} floor={floor} standalone />
          ))}
        </div>
      )}

      {/* Custom pattern input */}
      {showCustomInput && (
        <div className="mb-3 pt-3 border-t border-border">
          <label className="text-[11px] text-content-tertiary mb-2 block">
            Enter your naming pattern (e.g., Room-A, Room-B):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customPattern}
              onChange={(e) => setCustomPattern(e.target.value)}
              placeholder="e.g. Room-101, Room-102"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-content placeholder:text-content-tertiary focus:border-accent/40 focus:ring-1 focus:ring-accent/20 focus:outline-none"
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
              className={cn(BTN_PRIMARY, "w-auto flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed")}
            >
              Use this pattern
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2.5">
        {!showCustomInput && (
          <button
            onClick={() => setShowCustomInput(true)}
            className={cn(BTN_GHOST, "flex-1")}
          >
            Custom pattern
          </button>
        )}
        <button
          onClick={() =>
            onSendMessage?.(
              `Use the naming pattern: ${patternDescription || "default"} for ${firstFloor}`
            )
          }
          className={cn(BTN_PRIMARY, "flex-1")}
        >
          <span className="inline-flex items-center gap-2">
            Use these names <Check className="w-4 h-4" />
          </span>
        </button>
      </div>
    </div>
  );
}
