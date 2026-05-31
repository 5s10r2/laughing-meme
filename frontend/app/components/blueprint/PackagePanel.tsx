"use client";

import { CARD } from "../ui/primitives";
import { cap, plural } from "./tokens";

export interface PackageDetail {
  id: string;
  name: string;
  sharing?: string | null;
  config?: string | null;
  ac?: boolean;
  food?: string;
  furnishing?: string | null;
  rent?: number | null;
  billingBasis?: string | null;
  billingPeriod?: string | null;
  amenities?: string[];
  services?: string[];
  // listing terms (null when unset)
  depositMonths?: number | null;
  depositAmount?: number | null;
  lockInMonths?: number | null;
  noticeDays?: number | null;
  minStay?: number | null;
  roomCount?: number;
}

interface PackagePanelProps {
  packages?: PackageDetail[];
  /** singular noun for the mapped unit (room / flat / bed / unit); backend-projected */
  unitNoun?: string;
  /** opens the edit sheet for a package (Stage 2.6 edit — wired next) */
  onEdit?: (id: string) => void;
}

// Same palette + order as MappingRow, so a package reads as the same colour in
// the cards and on the mapping bars (both iterate active packages in model order).
const PKG_PALETTE = [
  "var(--t-single)",
  "var(--t-double)",
  "var(--t-deluxe)",
  "var(--t-triple)",
  "#8A7CC0",
  "#3F8E9B",
];

function rupees(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

function foodLabel(food?: string): string | null {
  if (!food || food === "none") return null;
  return food === "included" ? "Food incl." : "Food optional";
}

export function PackagePanel({ packages = [], unitNoun = "room", onEdit }: PackagePanelProps) {
  if (packages.length === 0) return null;
  return (
    <div className="lp-theme space-y-2">
      {packages.map((pkg, i) => {
        const attrs = [
          pkg.sharing ? cap(pkg.sharing) : pkg.config ? pkg.config.toUpperCase() : null,
          pkg.ac ? "AC" : "Non-AC",
          foodLabel(pkg.food),
          pkg.furnishing ? cap(pkg.furnishing.replace(/_/g, " ")) : null,
          pkg.billingBasis === "per_bed" ? "Per bed" : null,
        ].filter(Boolean) as string[];
        // listing terms — the India-critical money facts; only shown when set
        const deposit =
          pkg.depositMonths != null ? `Deposit ${pkg.depositMonths}mo`
          : pkg.depositAmount != null ? `Deposit ${rupees(pkg.depositAmount)}`
          : null;
        const terms = [
          deposit,
          pkg.noticeDays != null ? `Notice ${pkg.noticeDays}d` : null,
          pkg.lockInMonths != null ? `Lock-in ${pkg.lockInMonths}mo` : null,
          pkg.minStay != null ? `Min stay ${pkg.minStay}mo` : null,
        ].filter(Boolean) as string[];
        const period = pkg.billingPeriod === "weekly" ? "/wk" : pkg.billingPeriod === "daily" ? "/day" : "/mo";
        const rooms = pkg.roomCount ?? 0;
        return (
          <div key={pkg.id} className={CARD}>
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: PKG_PALETTE[i % PKG_PALETTE.length] }}
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold text-content truncate">{pkg.name}</span>
              </div>
              {pkg.rent != null && (
                <span className="text-sm font-semibold text-content shrink-0">
                  {rupees(pkg.rent)}
                  <span className="text-content-tertiary text-xs font-normal">{period}</span>
                </span>
              )}
            </div>

            {attrs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {attrs.map((a) => (
                  <span
                    key={a}
                    className="text-[11px] text-content-secondary px-2 py-0.5 rounded-full bg-bg-elevated border border-border"
                  >
                    {a}
                  </span>
                ))}
              </div>
            )}

            {/* Listing terms — deposit / notice / lock-in / min-stay (the money facts). */}
            {terms.length > 0 && (
              <p className="mt-2 text-[11px] font-medium text-content-secondary">
                {terms.join("  ·  ")}
              </p>
            )}

            {/* Amenities + services — secondary to the core attributes, lighter treatment. */}
            {((pkg.amenities && pkg.amenities.length > 0) || (pkg.services && pkg.services.length > 0)) && (
              <p className="mt-2 text-[11px] text-content-tertiary">
                {[...(pkg.amenities ?? []), ...(pkg.services ?? [])].join(" · ")}
              </p>
            )}

            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] font-mono text-content-tertiary">
                {rooms} {plural(unitNoun, rooms)} mapped
              </span>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(pkg.id)}
                  className="text-[11px] font-medium text-accent hover:opacity-80 transition-opacity cursor-pointer"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
