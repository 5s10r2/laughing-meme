"use client";

import { Check, Snowflake, Fan } from "lucide-react";
import { cn } from "../../../lib/cn";
import { ICON_SM } from "../../ui/primitives";

interface PackageReceiptProps {
  name: string;
  rent: number;
  ac: boolean;
  food?: string;
  furnishing?: string;
  security_deposit?: number;
  lock_in_period?: number;
  notice_period?: number;
}

export function PackageReceipt({ name: rawName, rent: rawRent, ac, food, furnishing, ...rest }: PackageReceiptProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed props from Claude
  const name = rawName || (rest.package_name as string) || (rest.packageName as string) || "Package";
  const rent = rawRent || (rest.starting_rent as number) || (rest.price as number) || 0;
  const deposit = (rest.security_deposit ?? rest.deposit) as number | undefined;
  const lockIn = (rest.lock_in_period ?? rest.lockIn) as number | undefined;
  const notice = (rest.notice_period ?? rest.notice) as number | undefined;
  const terms = [
    deposit ? `₹${Number(deposit).toLocaleString("en-IN")} deposit` : null,
    lockIn ? `${lockIn}mo lock-in` : null,
    notice ? `${notice}d notice` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center gap-3 py-2.5 px-3.5 rounded-xl bg-success/5 border border-success/12">
      <div className={cn(ICON_SM, "bg-success/12")}>
        <Check className="w-3 h-3 text-success" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-content font-medium truncate">{name}</p>
        {(food || furnishing) && (
          <p className="text-[11px] text-content-tertiary mt-0.5 truncate">
            {[
              ac ? "AC" : "Non-AC",
              food,
              furnishing ? String(furnishing).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {terms && (
          <p className="text-[11px] text-content-tertiary mt-0.5 truncate">{terms}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {ac ? (
          <Snowflake className="w-3 h-3 text-info" />
        ) : (
          <Fan className="w-3 h-3 text-content-tertiary" />
        )}
        <span className="text-sm font-semibold text-content">
          ₹{rent.toLocaleString("en-IN")}
        </span>
      </div>
    </div>
  );
}
