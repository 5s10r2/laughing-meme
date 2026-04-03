"use client";

import { Check, Snowflake, Fan } from "lucide-react";

interface PackageReceiptProps {
  name: string;
  rent: number;
  ac: boolean;
  food?: string;
  furnishing?: string;
}

export function PackageReceipt({ name: rawName, rent: rawRent, ac, food, furnishing, ...rest }: PackageReceiptProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed props from Claude
  const name = rawName || (rest.package_name as string) || (rest.packageName as string) || "Package";
  const rent = rawRent || (rest.starting_rent as number) || (rest.price as number) || 0;

  const badges: string[] = [];
  if (ac) badges.push("AC");
  if (food) badges.push(food);
  if (furnishing) {
    // Normalize: "semi_furnished" → "Semi Furnished"
    const formatted = String(furnishing)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    badges.push(formatted);
  }

  return (
    <div className="flex items-center gap-2 py-1.5 px-3 rounded-[var(--radius-button)] bg-success-surface border-l-2 border-l-success my-1">
      <Check className="w-3 h-3 text-success flex-shrink-0" />
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {ac ? (
          <Snowflake className="w-2.5 h-2.5 text-info flex-shrink-0" />
        ) : (
          <Fan className="w-2.5 h-2.5 text-content-tertiary flex-shrink-0" />
        )}
        <span className="text-xs text-success/80 truncate">
          {name}: <span className="font-semibold">₹{rent.toLocaleString("en-IN")}/mo</span>
        </span>
        {badges.length > 0 && (
          <span className="text-xs text-success/50 flex-shrink-0">
            {badges.join(", ")}
          </span>
        )}
      </div>
    </div>
  );
}
