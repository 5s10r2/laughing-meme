"use client";

import { useState } from "react";
import { Plus, Check, ArrowRight } from "lucide-react";
import { cn } from "../../../lib/cn";
import {
  CARD, PILL_ACCENT, PILL_SUCCESS, ICON_SM,
  BTN_PRIMARY, BTN_SECONDARY,
} from "../../ui/primitives";

interface PackageFormProps {
  name?: string;
  prefill?: {
    ac?: boolean;
    food?: "included" | "optional" | "none";
    furnishing?: "fully_furnished" | "semi_furnished" | "unfurnished";
    rent?: number;
    sharingType?: string;
    category?: string;
    securityDeposit?: number;
    lockInMonths?: number;
    noticeDays?: number;
  };
  onSendMessage?: (text: string) => void;
}

interface CreatedPackage {
  name: string;
  sharingType: string;
  ac: boolean;
  food: string;
  furnishing: string;
  rent: string;
}

const SHARING_OPTIONS = [
  { value: "private", label: "Private" },
  { value: "double", label: "Double" },
  { value: "triple", label: "Triple" },
  { value: "dormitory", label: "Dorm" },
] as const;

const FOOD_OPTIONS = [
  { value: "included" as const, label: "Included" },
  { value: "optional" as const, label: "Optional" },
  { value: "none" as const, label: "No food" },
];

const FURNISHING_OPTIONS = [
  { value: "fully_furnished" as const, label: "Fully" },
  { value: "semi_furnished" as const, label: "Semi" },
  { value: "unfurnished" as const, label: "Unfurn." },
];

/** Advance to next sharing type for smart defaults */
function nextSharingType(current: string): string {
  const order = ["private", "double", "triple", "dormitory"];
  const idx = order.indexOf(current);
  return order[Math.min(idx + 1, order.length - 1)] || "private";
}

function ToggleRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-[11px] text-content-tertiary mb-2">{label}</p>
      <div className="flex gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all border cursor-pointer",
              value === o.value
                ? "border-accent/30 bg-accent/8 text-accent-lighter"
                : "border-border bg-bg-elevated text-content-tertiary hover:bg-bg-subtle"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PackageForm({ name = "", prefill = {}, onSendMessage }: PackageFormProps) {

  const [packageName, setPackageName] = useState(name);
  const [sharingType, setSharingType] = useState<string>(
    prefill.sharingType || "private"
  );
  const [ac, setAc] = useState(prefill.ac ?? false);
  const [food, setFood] = useState<"included" | "optional" | "none">(prefill.food ?? "none");
  const [furnishing, setFurnishing] = useState<"fully_furnished" | "semi_furnished" | "unfurnished">(
    prefill.furnishing ?? "semi_furnished"
  );
  const [rent, setRent] = useState(prefill.rent?.toString() || "");
  const [deposit, setDeposit] = useState(prefill.securityDeposit?.toString() || "");
  const [lockIn, setLockIn] = useState(prefill.lockInMonths?.toString() || "");
  const [notice, setNotice] = useState(prefill.noticeDays?.toString() || "");

  // Progressive disclosure: step 1 = identity, step 2 = attributes
  const [step, setStep] = useState<1 | 2>(1);

  // Multi-create session tracking
  const [createdPackages, setCreatedPackages] = useState<CreatedPackage[]>([]);
  const [done, setDone] = useState(false);

  function handleSubmit() {
    if (!packageName.trim() || !rent.trim()) return;

    const sharingLabel = SHARING_OPTIONS.find((o) => o.value === sharingType)?.label || sharingType;
    const foodLabel = food === "included" ? "food included" : food === "optional" ? "food optional" : "no food";
    const furnishLabel = furnishing.replace(/_/g, " ");

    setCreatedPackages((prev) => [
      ...prev,
      { name: packageName.trim(), sharingType, ac, food: foodLabel, furnishing: furnishLabel, rent },
    ]);

    const terms = [
      deposit.trim() ? `deposit ₹${deposit.trim()}` : null,
      lockIn.trim() ? `lock-in ${lockIn.trim()} months` : null,
      notice.trim() ? `notice ${notice.trim()} days` : null,
    ].filter(Boolean);
    const termsStr = terms.length ? `, ${terms.join(", ")}` : "";

    const message = `Package: ${packageName.trim()}, ${sharingLabel} sharing, ${ac ? "AC" : "non-AC"}, ${foodLabel}, ${furnishLabel}, rent ₹${rent}${termsStr}`;
    onSendMessage?.(message);

    // Reset form with smart defaults for next package
    setPackageName("");
    setSharingType(nextSharingType(sharingType));
    setStep(1);
    // Keep AC, food, lock-in, and notice — likely same across packages
    setRent("");
    setDeposit("");
  }

  function handleDone() {
    setDone(true);
    if (createdPackages.length >= 1) {
      onSendMessage?.(`Done adding packages — created ${createdPackages.length} package${createdPackages.length !== 1 ? "s" : ""} total`);
    }
  }

  return (
    <div className={CARD}>
      <p className="text-xs font-medium text-content-tertiary mb-4">
        {name ? `Edit: ${name}` : "New package"}
      </p>

      {/* Created packages this session */}
      {createdPackages.length > 0 && (
        <div className="mb-4 pb-3 border-b border-border">
          <p className="text-[11px] text-content-tertiary mb-2">
            Created ({createdPackages.length}):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {createdPackages.map((pkg, i) => (
              <span key={i} className={PILL_SUCCESS}>
                <Check className="w-2.5 h-2.5" />
                {pkg.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Form (hidden when done) */}
      {!done && (
        <>
          {/* Step 1: Identity (name + sharing type) */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-content-tertiary mb-2">Package name</p>
                <input
                  type="text"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="e.g. AC Double Sharing"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-content placeholder-content-tertiary focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
                />
              </div>

              <ToggleRow
                label="Room type"
                options={SHARING_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={sharingType}
                onChange={setSharingType}
              />

              <button
                onClick={() => setStep(2)}
                disabled={!packageName.trim()}
                className={cn(BTN_PRIMARY, "disabled:opacity-40 disabled:cursor-not-allowed")}
              >
                <span className="inline-flex items-center gap-2">
                  Next — pricing &amp; amenities
                  <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            </div>
          )}

          {/* Step 2: Attributes (AC, food, furnishing, rent) */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-1">
                <button
                  onClick={() => setStep(1)}
                  className="text-xs text-content-tertiary hover:text-accent-lighter transition-colors cursor-pointer"
                >
                  ← Back
                </button>
                <span className={PILL_ACCENT}>{packageName}</span>
              </div>

              {/* AC Toggle */}
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-content-secondary">Air Conditioning</span>
                <button
                  onClick={() => setAc(!ac)}
                  role="switch"
                  aria-checked={ac}
                  className={cn(
                    "w-11 h-6 rounded-full transition-all duration-200 relative cursor-pointer",
                    ac ? "bg-accent" : "bg-bg-subtle"
                  )}
                >
                  <div
                    className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-200"
                    style={{ left: ac ? "22px" : "2px" }}
                  />
                </button>
              </div>

              <ToggleRow
                label="Food"
                options={FOOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={food}
                onChange={(v) => setFood(v as "included" | "optional" | "none")}
              />

              <ToggleRow
                label="Furnishing"
                options={FURNISHING_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={furnishing}
                onChange={(v) => setFurnishing(v as "fully_furnished" | "semi_furnished" | "unfurnished")}
              />

              {/* Rent */}
              <div>
                <p className="text-[11px] text-content-tertiary mb-2">Starting rent</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-content-tertiary font-medium">₹</span>
                  <input
                    type="number"
                    value={rent}
                    onChange={(e) => setRent(e.target.value)}
                    placeholder="8000"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-content focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
                  />
                  <span className="text-xs text-content-tertiary">/month</span>
                </div>
              </div>

              {/* Tenancy terms (optional) */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[11px] text-content-tertiary mb-2">Deposit ₹</p>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    placeholder={rent || "8000"}
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-content placeholder-content-tertiary focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-content-tertiary mb-2">Lock-in (mo)</p>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={lockIn}
                    onChange={(e) => setLockIn(e.target.value)}
                    placeholder="3"
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-content placeholder-content-tertiary focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-content-tertiary mb-2">Notice (days)</p>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={notice}
                    onChange={(e) => setNotice(e.target.value)}
                    placeholder="30"
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-content placeholder-content-tertiary focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={!rent.trim()}
                  className={cn(
                    BTN_PRIMARY, "flex-1",
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                >
                  {createdPackages.length > 0 ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" />
                      Save &amp; add another
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-2">
                      Save {packageName.trim() || "package"}
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                </button>

                {createdPackages.length > 0 && (
                  <button onClick={handleDone} className={BTN_SECONDARY}>
                    Done
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Done state */}
      {done && (
        <div className="flex items-center gap-2">
          <div className={cn(ICON_SM, "bg-success/12")}>
            <Check className="w-3 h-3 text-success" />
          </div>
          <span className="text-sm text-success font-medium">
            {createdPackages.length} package{createdPackages.length !== 1 ? "s" : ""} created
          </span>
        </div>
      )}
    </div>
  );
}
