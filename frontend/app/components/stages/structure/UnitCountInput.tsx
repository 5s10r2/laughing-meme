"use client";

import { useState, useCallback } from "react";
import { Minus, Plus, Home, BedDouble, Building, DoorOpen, Copy, ChevronsRight, Check, ArrowRight } from "lucide-react";
import { cn } from "../../../lib/cn";
import { FloorChipBar } from "../../ui/FloorChipBar";
import { CARD, BTN_PRIMARY, BTN_SECONDARY, ICON_SM } from "../../ui/primitives";

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

function CategoryIcon({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category.toLowerCase()] || Home;
  return <Icon className={className} />;
}

function SingleStepper({
  count,
  min,
  max,
  disabled,
  onChange,
}: {
  count: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-5 py-3">
      <button
        onClick={() => onChange(Math.max(min, count - 1))}
        disabled={count <= min || disabled}
        className="w-11 h-11 rounded-full border border-border bg-bg-elevated hover:bg-bg-subtle flex items-center justify-center text-lg text-content-secondary transition-all active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Minus className="w-4 h-4" />
      </button>
      <span className="text-3xl font-bold text-content w-12 text-center">{count}</span>
      <button
        onClick={() => onChange(Math.min(max, count + 1))}
        disabled={count >= max || disabled}
        className="w-11 h-11 rounded-full border border-border bg-bg-elevated hover:bg-bg-subtle flex items-center justify-center text-lg text-content-secondary transition-all active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Plus className="w-4 h-4" />
      </button>
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
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg-elevated">
      <div className="flex items-center gap-1.5 min-w-[80px]">
        <CategoryIcon category={type.category} className="w-3.5 h-3.5 text-content-tertiary" />
        <span className="text-xs text-content-secondary font-medium">{type.label}</span>
      </div>
      <div className="flex items-center gap-1.5 ml-auto">
        <button
          onClick={() => onChange(Math.max(0, count - 1))}
          disabled={count <= 0 || disabled}
          className="w-7 h-7 rounded-full flex items-center justify-center border border-border bg-bg-elevated text-content-secondary hover:bg-bg-subtle active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <Minus className="w-3 h-3" />
        </button>
        <div className="w-8 text-center">
          <span className="text-sm font-bold text-content">{count}</span>
        </div>
        <button
          onClick={() => onChange(Math.min(50, count + 1))}
          disabled={count >= 50 || disabled}
          className="w-7 h-7 rounded-full flex items-center justify-center border border-border bg-bg-elevated text-content-secondary hover:bg-bg-subtle active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════
//  BATCH MODE -- multi-floor input with FloorChipBar
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
    <div className={cn(CARD, "my-2")}>
      <p className="text-xs font-medium text-content-tertiary mb-1">Set rooms per floor</p>

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
        <p className="text-xs text-content-secondary font-medium">{selectedFloor?.label}</p>
        <span className="text-[11px] text-content-tertiary">
          {confirmedCount}/{floors.length} set
        </span>
      </div>

      {selectedFloor?.suggestedRange && !isMulti && (
        <p className="text-[11px] text-content-tertiary/70 mb-2">
          Suggested: {selectedFloor.suggestedRange[0]}&ndash;{selectedFloor.suggestedRange[1]} rooms
        </p>
      )}

      {/* ── Stepper for selected floor ── */}
      {!isMulti && (
        <SingleStepper
          count={state.simpleCount}
          min={min}
          max={max}
          disabled={state.confirmed || submitted}
          onChange={(n) => updateState(selectedIdx, { simpleCount: n })}
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
              className={cn(BTN_SECONDARY, "flex items-center gap-1 text-xs")}
            >
              <Copy className="w-3 h-3" />
              Same as above
            </button>
          )}
          {floors.length > 2 && selectedIdx < floors.length - 1 && (
            <button
              onClick={setForAllRemaining}
              className={cn(BTN_SECONDARY, "flex items-center gap-1 text-xs")}
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
          className={cn(BTN_SECONDARY, "mt-3 w-full")}
        >
          <span className="inline-flex items-center gap-2">
            Confirm {selectedFloor?.label} <ArrowRight className="w-4 h-4" />
          </span>
        </button>
      )}

      {state.confirmed && !submitted && (
        <div className="flex items-center gap-1.5 mt-3">
          <div className={cn(ICON_SM, "bg-success/12")}>
            <Check className="w-3 h-3 text-success" />
          </div>
          <span className="text-sm text-success font-medium">{selectedFloor?.label} set</span>
        </div>
      )}

      {/* ── Final submit (all floors confirmed) ── */}
      {allConfirmed && !submitted && (
        <button
          onClick={handleFinalSubmit}
          className={cn(BTN_PRIMARY, "mt-3")}
        >
          <span className="inline-flex items-center gap-2">
            Set all {floors.length} floors <ArrowRight className="w-4 h-4" />
          </span>
        </button>
      )}

      {submitted && (
        <div className="flex items-center gap-1.5 mt-3">
          <div className={cn(ICON_SM, "bg-success/12")}>
            <Check className="w-3 h-3 text-success" />
          </div>
          <span className="text-sm text-success font-medium">All floors set</span>
        </div>
      )}
    </div>
  );
}

function SingleUnitInput({
  floorLabel: rawFloorLabel,
  unitTypes: rawUnitTypes,
  currentCount = 4,
  suggestedRange,
  hint,
  floors: rawFloors,
  onSendMessage,
  ...rest
}: UnitCountInputProps & Record<string, unknown>) {
  // ── Single-floor mode (original behavior) ──
  const floorLabel =
    rawFloorLabel ||
    (rest.floor_label as string) ||
    (rest.floor as string) ||
    (rest.label as string) ||
    (rawFloors?.[0]?.label) ||
    "Floor";

  const rawTypes =
    rawUnitTypes ||
    (rest.unit_types as UnitTypeCount[]) ||
    (rest.unitTypeBreakdown as UnitTypeCount[]) ||
    (rest.unit_breakdown as UnitTypeCount[]) ||
    (rest.breakdown as UnitTypeCount[]) ||
    rawFloors?.[0]?.unitTypes;

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

  const min = suggestedRange?.[0] ?? rawFloors?.[0]?.suggestedRange?.[0] ?? 1;
  const max = suggestedRange?.[1] ?? rawFloors?.[0]?.suggestedRange?.[1] ?? 50;

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
        return parts.length > 0 ? `Set ${parts.join(" + ")}` : "Set units";
      })()
    : `Set ${simpleCount} ${unitTypes && unitTypes.length === 1 ? unitTypes[0].label.toLowerCase() : "rooms"}`;

  return (
    <div className={cn(CARD, "my-2")}>
      <p className="text-xs font-medium text-content-tertiary mb-1">{floorLabel}</p>

      {suggestedRange && !isMultiType && (
        <p className="text-[11px] text-content-tertiary/70 mb-4">
          How many rooms on this floor?
        </p>
      )}

      {!isMultiType && (
        <>
          <SingleStepper
            count={simpleCount}
            min={min}
            max={max}
            disabled={submitted}
            onChange={setSimpleCount}
          />

          {quickFillValues.length > 0 && !submitted && (
            <div className="flex gap-2 justify-center mt-3 mb-4">
              {quickFillValues.map((v) => (
                <button
                  key={v}
                  onClick={() => setSimpleCount(v)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer",
                    simpleCount === v
                      ? "bg-accent/10 text-accent-lighter border border-accent/20"
                      : "bg-bg-elevated text-content-tertiary border border-border hover:bg-bg-subtle"
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
            className={cn(BTN_PRIMARY, "disabled:opacity-40 disabled:cursor-not-allowed")}
          >
            {submitted ? (
              <span className="inline-flex items-center gap-2">
                <Check className="w-4 h-4" /> Sent
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                {submitLabel} <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </>
      )}

      {isMultiType && unitTypes && (
        <>
          <p className="text-[11px] text-content-tertiary/70 mb-4">
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

          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-content-tertiary">Total units</span>
            <span className="text-sm font-bold text-content">{multiTotal}</span>
          </div>

          <button
            onClick={handleSubmitMulti}
            disabled={submitted || multiTotal === 0}
            className={cn(BTN_PRIMARY, "disabled:opacity-40 disabled:cursor-not-allowed")}
          >
            {submitted ? (
              <span className="inline-flex items-center gap-2">
                <Check className="w-4 h-4" /> Sent
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                {submitLabel} <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </>
      )}

      {hint && <p className="text-xs text-content-tertiary mt-2">{hint}</p>}
    </div>
  );
}

function parseFloors(rawFloors: unknown): FloorConfig[] | undefined {
  if (!Array.isArray(rawFloors) || rawFloors.length === 0) return undefined;
  return rawFloors.map((r: unknown, i: number) => {
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
      suggestedRange: Array.isArray(sr)
        ? ([Number(sr[0]), Number(sr[1])] as [number, number])
        : undefined,
    };
  });
}

// ════════════════════════════════════════════════
//  MAIN EXPORT -- routes to single or batch mode
// ════════════════════════════════════════════════

export function UnitCountInput({
  floors: rawFloors,
  onSendMessage,
  ...props
}: UnitCountInputProps & Record<string, unknown>) {
  const batchFloors = parseFloors(rawFloors || props.batch_floors || props.batchFloors);

  if (batchFloors && batchFloors.length > 1) {
    return <BatchUnitInput floors={batchFloors} onSendMessage={onSendMessage} />;
  }

  return (
    <SingleUnitInput
      {...props}
      floors={batchFloors}
      onSendMessage={onSendMessage}
    />
  );
}
