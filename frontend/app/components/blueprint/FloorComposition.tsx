"use client";

import { cn } from "../../lib/cn";

/**
 * FloorComposition — the keystone primitive of the Living Blueprint working view.
 *
 * A proportional, colour-segmented bar over a floor's units, an optional legend,
 * and optional capped room cells ("+N" overflow). DIMENSION-AGNOSTIC: it takes
 * coloured segments, so the same component re-skins by stage — segments coloured
 * by room type (structure) or by package (mapping). Consumed by FloorLedger, the
 * floor drill-down, and the mapping components.
 *
 * Accessibility: the bar carries a text summary via aria-label (colour is never
 * the sole channel); the legend is the visible text source of truth; the cells
 * are decorative and hidden from assistive tech.
 */

export interface CompositionSegment {
  key: string;
  label: string;
  count: number;
  /** any CSS colour — e.g. "var(--t-single)" or a package colour */
  color: string;
}

interface FloorCompositionProps {
  segments: CompositionSegment[];
  /** show individual room cells below the bar (the tap-to-expand state) */
  showCells?: boolean;
  /** show the labelled legend between bar and cells */
  showLegend?: boolean;
  /** max cells before collapsing to "+N" */
  cellCap?: number;
  className?: string;
}

export function FloorComposition({
  segments,
  showCells = false,
  showLegend = false,
  cellCap = 8,
  className,
}: FloorCompositionProps) {
  const nonEmpty = segments.filter((s) => s.count > 0);
  const total = nonEmpty.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;

  const summary = nonEmpty.map((s) => `${s.count} ${s.label}`).join(", ");

  // flatten to a per-room colour list for the cells
  const flat: string[] = [];
  for (const s of nonEmpty) for (let i = 0; i < s.count; i++) flat.push(s.color);
  const shown = flat.slice(0, cellCap);
  const overflow = total - shown.length;

  return (
    <div className={className}>
      {/* proportional bar — colour + an accessible text summary */}
      <div className="flex h-1.5 rounded-full overflow-hidden" role="img" aria-label={summary}>
        {nonEmpty.map((s) => (
          <div
            key={s.key}
            style={{ width: `${(s.count / total) * 100}%`, background: s.color }}
          />
        ))}
      </div>

      {/* legend — the visible text source of truth */}
      {showLegend && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {nonEmpty.map((s) => (
            <span
              key={s.key}
              className="inline-flex items-center gap-1.5 text-[11px] text-content-secondary"
            >
              <span className="w-2 h-2 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
              {s.count} {s.label}
            </span>
          ))}
        </div>
      )}

      {/* room cells — decorative; the bar/legend already convey the mix */}
      {showCells && (
        <div className="flex flex-wrap gap-1.5 mt-2.5" aria-hidden="true">
          {shown.map((color, i) => (
            <span
              key={`${color}-${i}`}
              className="w-7 h-7 rounded-lg"
              style={{ background: color }}
            />
          ))}
          {overflow > 0 && (
            <span
              className={cn(
                "w-7 h-7 rounded-lg border border-dashed border-border",
                "flex items-center justify-center text-[10px] font-mono text-content-tertiary"
              )}
            >
              +{overflow}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
