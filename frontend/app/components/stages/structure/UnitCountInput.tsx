"use client";

import { useState, useCallback } from "react";
import { Minus, Plus, Home, BedDouble, Building, DoorOpen, Copy, ChevronsRight, Check } from "lucide-react";
import { cn } from "../../../lib/cn";
import { FloorChipBar } from "../../ui/FloorChipBar";

interface UnitTypeCount {
  category: string;
  label: string;
  count: number;
}

interface FloorConfig {
  index: number;
  label: string;
  unitTypes?: UnitTypeCount[];
  suggestedRange?: [number, number];
}

interface UnitCountInputProps {
  floorLabel: string;
  unitTypes?: UnitTypeCount[];
  currentCount?: number;
  suggestedRange?: [number, number];
  hint?: string;
  /** NEW: multi-floor batch mode */
  floors?: FloorConfig[];
  onSendMessage?: (text: string) => void;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  pg_room: Home,
  room: Home,
  rooms: Home,
  studio: Building,
  studios: Building,
  flat: DoorOpen,
  flats: DoorOpen,
  rk: DoorOpen,
  hostel_dorm: BedDouble,
  bed: BedDouble,
  beds: BedDouble,
  dorm: BedDouble,
};

function getCategoryIcon(category: string): React.ElementType {
  return CATEGORY_ICONS[category.toLowerCase()] || Home;
}

function SingleStepper({
  label,
  count,
  min,
  max,
  disabled,
  onChange,
  icon: Icon,
}: {
  label: string;
  count: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (n: number) => void;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChange(Math.max(min, count - 1))}
          disabled={count <= min || disabled}
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center",
            "border border-zinc-700 bg-zinc-800 text-zinc-400",
            "hover:bg-zinc-700 active:scale-95 transition-all",
            "disabled:opacity-30 disabled:cursor-not-allowed"
          )}
        >
          <Minus className="w-3 h-3" />
        </button>

        <div className="w-10 text-center">
          <span className="text-lg font-bold text-zinc-100">{count}</span>
        </div>

        <button
          onClick={() => onChange(Math.min(max, count + 1))}
          disabled={count >= max || disabled}
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center",
            "border border-zinc-700 bg-zinc-800 text-zinc-400",
            "hover:bg-zinc-700 active:scale-95 transition-all",
            "disabled:opacity-30 disabled:cursor-not-allowed"
          )}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3 text-zinc-500" />}
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
    </div>
  );
}

// ── Multi-type stepper row (compact) ──
function TypeStepperRow({
  type,
  count,
  disabled,
  onChange,
}: {
  type: UnitTypeCount;
  count: number;
  disabled: boolean;
  onChange: (n: number) => void;
}) {
  const Icon = getCategoryIcon(type.category);
  return (
    <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-zinc-800/30">
      <div className="flex items-center gap-1.5 min-w-[80px]">
        <Icon className="w-3 h-3 text-zinc-500" />
        <span className="text-xs text-zinc-400 font-medium">{type.label}</span>
      </div>
      <div className="flex items-center gap-1.5 ml-auto">
        <button
          onClick={() => onChange(Math.max(0, count - 1))}
          disabled={count <= 0 || disabled}
          className={cn(
            "w-6 h-6 rounded flex items-center justify-center",
            "border border-zinc-700 bg-zinc-800 text-zinc-400",
            "hover:bg-zinc-700 active:scale-95 transition-all",
            "disabled:opacity-30 disabled:cursor-not-allowed"
          )}
        >
          <Minus className="w-2.5 h-2.5" />
        </button>
        <div className="w-8 text-center">
          <span className="text-sm font-bold text-zinc-100">{count}</span>
        </div>
        <button
          onClick={() => onChange(Math.min(50, count + 1))}
          disabled={count >= 50 || disabled}
          className={cn(
            "w-6 h-6 rounded flex items-center justify-center",
            "border border-zinc-700 bg-zinc-800 text-zinc-400",
            "hover:bg-zinc-700 active:scale-95 transition-all",
            "disabled:opacity-30 disabled:cursor-not-allowed"
          )}
        >
          <Plus className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════
//  BATCH MODE — multi-floor input with FloorChipBar
// ════════════════════════════════════════════════════

interface FloorState {
  simpleCount: number;
  typeCounts: Record<string, number>;
  confirmed: boolean;
}

function BatchUnitInput({
  floors,
  onSendMessage,
}: {
  floors: FloorConfig[];
  onSendMessage?: (text: string) => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  // Per-floor state
  const [floorStates, setFloorStates] = useState<FloorState[]>(() =>
    floors.map((f) => {
      const isMulti = f.unitTypes && f.unitTypes.length > 1;
      const typeCounts: Record<string, number> = {};
      if (f.unitTypes) {
        for (const t of f.unitTypes) typeCounts[t.category] = t.count;
      }
      return {
        simpleCount: !isMulti && f.unitTypes?.length === 1 ? f.unitTypes[0].count || 4 : 4,
        typeCounts,
        confirmed: false,
      };
    })
  );

  const selectedFloor = floors[selectedIdx];
  const state = floorStates[selectedIdx];
  const isMulti = selectedFloor?.unitTypes && selectedFloor.unitTypes.length > 1;
  const min = selectedFloor?.suggestedRange?.[0] ?? 1;
  const max = selectedFloor?.suggestedRange?.[1] ?? 50;

  const updateState = useCallback(
    (idx: number, patch: Partial<FloorState>) => {
      setFloorStates((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      });
    },
    []
  );

  const confirmedCount = floorStates.filter((s) => s.confirmed).length;
  const allConfirmed = confirmedCount === floors.length;

  // ── Batch shortcuts ──
  function copyFromPrevious() {
    if (selectedIdx === 0) return;
    const prev = floorStates[selectedIdx - 1];
    updateState(selectedIdx, {
      simpleCount: prev.simpleCount,
      typeCounts: { ...prev.typeCounts },
    });
  }

  function setForAllRemaining() {
    const current = floorStates[selectedIdx];
    setFloorStates((prev) => {
      const next = [...prev];
      for (let i = selectedIdx; i < next.length; i++) {
        if (!next[i].confirmed) {
          next[i] = {
            ...next[i],
            simpleCount: current.simpleCount,
            typeCounts: { ...current.typeCounts },
            confirmed: true,
          };
        }
      }
      return next;
    });
  }

  function confirmCurrentFloor() {
    updateState(selectedIdx, { confirmed: true });
    // Auto-advance to next unconfirmed floor
    const nextUnconfirmed = floorStates.findIndex(
      (s, i) => i > selectedIdx && !s.confirmed
    );
    if (nextUnconfirmed !== -1) {
      setSelectedIdx(nextUnconfirmed);
    }
  }

  function handleFinalSubmit() {
    if (submitted) return;
    setSubmitted(true);
    const parts = floors.map((f, i) => {
      const s = floorStates[i];
      const isM = f.unitTypes && f.unitTypes.length > 1;
      if (isM && f.unitTypes) {
        const typeParts = f.unitTypes
          .map((t) => {
            const c = s.typeCounts[t.category] || 0;
            return c > 0 ? `${c} ${t.label.toLowerCase()}` : null;
          })
          .filter(Boolean);
        return `${f.label}=${typeParts.join("+")}`;
      }
      const label =
        f.unitTypes?.length === 1 ? f.unitTypes[0].label.toLowerCase() : "rooms";
      return `${f.label}=${s.simpleCount} ${label}`;
    });
    onSendMessage?.(`Set rooms: ${parts.join(", ")}`);
  }

  // Chip bar data
  const chipFloors = floors.map((f, i) => ({
    index: i,
    label: f.label,
    status: floorStates[i].confirmed
      ? ("done" as const)
      : i === selectedIdx
        ? ("active" as const)
        : ("pending" as const),
  }));

  return (
    <div className="border border-zinc-800 border-l-2 border-l-amber-500/30 bg-zinc-900/40 rounded-xl px-3.5 py-3 my-2">
      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-2">
        Set rooms per floor
      </p>

      {/* Floor navigation */}
      <div className="mb-3">
        <FloorChipBar
          floors={chipFloors}
          selected={selectedIdx}
          onSelect={setSelectedIdx}
        />
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-zinc-300 font-medium">{selectedFloor?.label}</p>
        <span className="text-[11px] text-zinc-600">
          {confirmedCount}/{floors.length} set
        </span>
      </div>

      {selectedFloor?.suggestedRange && !isMulti && (
        <p className="text-xs text-zinc-500 mb-2">
          Suggested: {selectedFloor.suggestedRange[0]}&ndash;{selectedFloor.suggestedRange[1]} rooms
        </p>
      )}

      {/* ── Stepper for selected floor ── */}
      {!isMulti && (
        <SingleStepper
          label={
            selectedFloor?.unitTypes?.length === 1
              ? selectedFloor.unitTypes[0].label.toLowerCase()
              : "rooms"
          }
          count={state.simpleCount}
          min={min}
          max={max}
          disabled={state.confirmed || submitted}
          onChange={(n) => updateState(selectedIdx, { simpleCount: n })}
          icon={
            selectedFloor?.unitTypes?.length === 1
              ? getCategoryIcon(selectedFloor.unitTypes[0].category)
              : undefined
          }
        />
      )}

      {isMulti && selectedFloor?.unitTypes && (
        <div className="space-y-2">
          {selectedFloor.unitTypes.map((t) => (
            <TypeStepperRow
              key={t.category}
              type={t}
              count={state.typeCounts[t.category] || 0}
              disabled={state.confirmed || submitted}
              onChange={(n) =>
                updateState(selectedIdx, {
                  typeCounts: { ...state.typeCounts, [t.category]: n },
                })
              }
            />
          ))}
        </div>
      )}

      {/* ── Batch shortcuts ── */}
      {!state.confirmed && !submitted && (
        <div className="flex gap-2 mt-3">
          {selectedIdx > 0 && (
            <button
              onClick={copyFromPrevious}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium",
                "text-zinc-400 border border-zinc-700",
                "hover:bg-zinc-800 active:scale-95 transition-all"
              )}
            >
              <Copy className="w-3 h-3" />
              Same as above
            </button>
          )}
          {floors.length > 2 && selectedIdx < floors.length - 1 && (
            <button
              onClick={setForAllRemaining}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium",
                "text-zinc-400 border border-zinc-700",
                "hover:bg-zinc-800 active:scale-95 transition-all"
              )}
            >
              <ChevronsRight className="w-3 h-3" />
              Set for all remaining
            </button>
          )}
        </div>
      )}

      {/* ── Per-floor confirm ── */}
      {!state.confirmed && !submitted && !allConfirmed && (
        <button
          onClick={confirmCurrentFloor}
          className={cn(
            "mt-3 w-full px-3 py-2 rounded-lg text-xs font-semibold",
            "bg-zinc-800 text-zinc-300 border border-zinc-700",
            "hover:bg-zinc-700 active:scale-95 transition-all"
          )}
        >
          Confirm {selectedFloor?.label} →
        </button>
      )}

      {state.confirmed && !submitted && (
        <div className="flex items-center gap-1.5 mt-3 text-xs text-emerald-400">
          <Check className="w-3 h-3" />
          <span>{selectedFloor?.label} set</span>
        </div>
      )}

      {/* ── Final submit (all floors confirmed) ── */}
      {allConfirmed && !submitted && (
        <button
          onClick={handleFinalSubmit}
          className={cn(
            "mt-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-semibold",
            "bg-amber-500/20 text-amber-300 border border-amber-500/25",
            "hover:bg-amber-500/25 active:scale-95 transition-all"
          )}
        >
          Set all {floors.length} floors →
        </button>
      )}

      {submitted && (
        <p className="mt-3 text-xs text-emerald-400 font-medium">
          All floors set
        </p>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
//  MAIN EXPORT — routes to single or batch mode
// ════════════════════════════════════════════════

export function UnitCountInput({
  floorLabel: rawFloorLabel,
  unitTypes: rawUnitTypes,
  currentCount = 4,
  suggestedRange,
  hint,
  floors: rawFloors,
  onSendMessage,
  ...rest
}: UnitCountInputProps & Record<string, unknown>) {

  // ── Parse batch floors if provided ──
  const batchFloors: FloorConfig[] | undefined = (() => {
    const raw = rawFloors || rest.batch_floors || rest.batchFloors;
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    return (raw as unknown[]).map((r: unknown, i: number) => {
      const f = r as Record<string, unknown>;
      const rawTypes = f.unitTypes || f.unit_types || f.breakdown;
      const unitTypes: UnitTypeCount[] | undefined = Array.isArray(rawTypes)
        ? (rawTypes as unknown[]).map((t: unknown) => {
            const tt = t as Record<string, unknown>;
            return {
              category: (tt.category || tt.type || "room") as string,
              label: (tt.label || tt.name || "Rooms") as string,
              count: Number(tt.count ?? 0),
            };
          })
        : undefined;
      const sr = f.suggestedRange || f.suggested_range;
      return {
        index: Number(f.index ?? i),
        label: (f.label || f.name || f.floor || `Floor ${i}`) as string,
        unitTypes,
        suggestedRange: Array.isArray(sr) ? [Number(sr[0]), Number(sr[1])] as [number, number] : undefined,
      };
    });
  })();

  // ── Batch mode ──
  if (batchFloors && batchFloors.length > 1) {
    return <BatchUnitInput floors={batchFloors} onSendMessage={onSendMessage} />;
  }

  // ── Single-floor mode (original behavior) ──
  const floorLabel =
    rawFloorLabel ||
    (rest.floor_label as string) ||
    (rest.floor as string) ||
    (rest.label as string) ||
    (batchFloors?.[0]?.label) ||
    "Floor";

  const rawTypes =
    rawUnitTypes ||
    (rest.unit_types as UnitTypeCount[]) ||
    (rest.unitTypeBreakdown as UnitTypeCount[]) ||
    (rest.unit_breakdown as UnitTypeCount[]) ||
    (rest.breakdown as UnitTypeCount[]) ||
    batchFloors?.[0]?.unitTypes;

  const unitTypes: UnitTypeCount[] | undefined = Array.isArray(rawTypes)
    ? (rawTypes as unknown[]).map((raw: unknown) => {
        const t = raw as Record<string, unknown>;
        return {
          category: (t.category || t.type || "room") as string,
          label: (t.label || t.name || t.type || "Rooms") as string,
          count: Number(t.count ?? t.value ?? t.number ?? 0),
        };
      })
    : undefined;

  const isMultiType = unitTypes && unitTypes.length > 1;

  const [simpleCount, setSimpleCount] = useState(
    !isMultiType
      ? unitTypes && unitTypes.length === 1
        ? unitTypes[0].count || currentCount
        : currentCount
      : 0
  );

  const [typeCounts, setTypeCounts] = useState<Record<string, number>>(() => {
    if (!isMultiType || !unitTypes) return {};
    const counts: Record<string, number> = {};
    for (const t of unitTypes) counts[t.category] = t.count;
    return counts;
  });

  const [submitted, setSubmitted] = useState(false);

  const min = suggestedRange?.[0] ?? batchFloors?.[0]?.suggestedRange?.[0] ?? 1;
  const max = suggestedRange?.[1] ?? batchFloors?.[0]?.suggestedRange?.[1] ?? 50;

  const quickFillValues =
    suggestedRange && !isMultiType
      ? Array.from(
          new Set([
            suggestedRange[0],
            Math.round((suggestedRange[0] + suggestedRange[1]) / 2),
            suggestedRange[1],
          ])
        ).filter((v) => v >= min && v <= max)
      : [];

  function handleSubmitSimple() {
    if (submitted) return;
    setSubmitted(true);
    const label =
      unitTypes && unitTypes.length === 1
        ? unitTypes[0].label.toLowerCase()
        : "rooms";
    onSendMessage?.(`Set ${simpleCount} ${label} for ${floorLabel}`);
  }

  function handleSubmitMulti() {
    if (submitted || !unitTypes) return;
    setSubmitted(true);
    const parts = unitTypes
      .map((t) => {
        const c = typeCounts[t.category] || 0;
        return c > 0 ? `${c} ${t.label.toLowerCase()}` : null;
      })
      .filter(Boolean);
    if (parts.length === 0) {
      onSendMessage?.(`Set 0 units for ${floorLabel}`);
    } else {
      onSendMessage?.(`Set ${floorLabel}: ${parts.join(", ")}`);
    }
  }

  function updateTypeCount(category: string, value: number) {
    setTypeCounts((prev) => ({
      ...prev,
      [category]: Math.max(0, Math.min(50, value)),
    }));
  }

  const multiTotal = isMultiType
    ? Object.values(typeCounts).reduce((s, c) => s + c, 0)
    : 0;

  const submitLabel = isMultiType
    ? (() => {
        const parts = (unitTypes || [])
          .map((t) => {
            const c = typeCounts[t.category] || 0;
            return c > 0 ? `${c} ${t.label.toLowerCase()}` : null;
          })
          .filter(Boolean);
        return parts.length > 0 ? `Set ${parts.join(" + ")} →` : "Set units →";
      })()
    : `Set ${simpleCount} ${unitTypes && unitTypes.length === 1 ? unitTypes[0].label.toLowerCase() : "rooms"} →`;

  return (
    <div className="border border-zinc-800 border-l-2 border-l-amber-500/30 bg-zinc-900/40 rounded-xl px-3.5 py-3 my-2">
      <p className="text-xs text-zinc-300 font-medium mb-1">{floorLabel}</p>

      {suggestedRange && !isMultiType && (
        <p className="text-xs text-zinc-500 mb-2.5">
          Tarini suggests {suggestedRange[0]}&ndash;{suggestedRange[1]} rooms
          for this floor
        </p>
      )}

      {!isMultiType && (
        <>
          <SingleStepper
            label={
              unitTypes && unitTypes.length === 1
                ? unitTypes[0].label.toLowerCase()
                : "rooms"
            }
            count={simpleCount}
            min={min}
            max={max}
            disabled={submitted}
            onChange={setSimpleCount}
            icon={
              unitTypes && unitTypes.length === 1
                ? getCategoryIcon(unitTypes[0].category)
                : undefined
            }
          />

          {quickFillValues.length > 0 && !submitted && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-xs text-zinc-600">Quick:</span>
              {quickFillValues.map((v) => (
                <button
                  key={v}
                  onClick={() => setSimpleCount(v)}
                  className={cn(
                    "px-2.5 py-1 min-w-[36px] min-h-[32px] flex items-center justify-center rounded text-xs font-medium transition-all",
                    simpleCount === v
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-zinc-800/60 text-zinc-500 border border-zinc-700/50 hover:text-zinc-300"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handleSubmitSimple}
            disabled={submitted}
            className={cn(
              "mt-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-semibold",
              "bg-amber-500/20 text-amber-300 border border-amber-500/25",
              "hover:bg-amber-500/25 active:scale-95 transition-all",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {submitted ? "Sent" : submitLabel}
          </button>
        </>
      )}

      {isMultiType && unitTypes && (
        <>
          <p className="text-xs text-zinc-500 mb-2.5">
            This floor has mixed unit types. Set the count for each:
          </p>

          <div className="space-y-2 mb-3">
            {unitTypes.map((t) => (
              <TypeStepperRow
                key={t.category}
                type={t}
                count={typeCounts[t.category] || 0}
                disabled={submitted}
                onChange={(n) => updateTypeCount(t.category, n)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-500">Total units</span>
            <span className="text-sm font-bold text-zinc-200">{multiTotal}</span>
          </div>

          <button
            onClick={handleSubmitMulti}
            disabled={submitted || multiTotal === 0}
            className={cn(
              "w-full px-3 py-2.5 rounded-lg text-[13px] font-semibold",
              "bg-amber-500/20 text-amber-300 border border-amber-500/25",
              "hover:bg-amber-500/25 active:scale-95 transition-all",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {submitted ? "Sent" : submitLabel}
          </button>
        </>
      )}

      {hint && <p className="text-xs text-zinc-600 mt-2">{hint}</p>}
    </div>
  );
}
