"use client";

import { useState } from "react";
import {
  Sparkles, Snowflake, Fan, ChevronLeft, ChevronRight, Check, X,
  UtensilsCrossed, Sofa, ArrowRight,
} from "lucide-react";
import { cn } from "../../../lib/cn";
import { humanizeSharingType, humanizeCategorySingular } from "../../../lib/property-utils";
import {
  CARD,
  ICON_CIRCLE, ICON_SM, BTN_PRIMARY, BTN_SECONDARY,
  AttrChip,
} from "../../ui/primitives";

interface SuggestedPackage {
  name: string;
  sharingType?: string;
  ac: boolean;
  estimatedRent?: string;
  category?: string;
  food?: string;
  furnishing?: string;
}

interface PackageSuggestionCardProps {
  suggestions: SuggestedPackage[];
  location?: string;
  onSendMessage?: (text: string) => void;
}

/** Threshold at which we switch from flat list to card stack */
const STACK_THRESHOLD = 3;

function parseRent(raw?: string): number | null {
  if (!raw) return null;
  const n = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? null : n;
}

export function PackageSuggestionCard({
  suggestions: rawSuggestions,
  location,
  onSendMessage,
}: PackageSuggestionCardProps) {
  const parsedSuggestions: SuggestedPackage[] = (Array.isArray(rawSuggestions) ? rawSuggestions : []).map((raw: unknown) => {
    const p = raw as Record<string, unknown>;
    return {
      name: (p.name || p.package_name || p.packageName || "Package") as string,
      sharingType: (p.sharingType || p.sharing_type) as string | undefined,
      ac: Boolean(p.ac),
      estimatedRent: (p.estimatedRent || p.estimated_rent || p.rent) as string | undefined,
      category: (p.category || p.type || p.unit_type) as string | undefined,
      food: (p.food || p.food_type) as string | undefined,
      furnishing: (p.furnishing || p.furnishing_type) as string | undefined,
    };
  });

  // ── Flat list mode (1-2 suggestions) ──
  if (parsedSuggestions.length < STACK_THRESHOLD) {
    return (
      <FlatSuggestionList
        suggestions={parsedSuggestions}
        location={location}
        onSendMessage={onSendMessage}
      />
    );
  }

  // ── Card stack mode (3+ suggestions) ──
  return (
    <CardStack
      suggestions={parsedSuggestions}
      location={location}
      onSendMessage={onSendMessage}
    />
  );
}

// ════════════════════════════════════════════
//  FLAT LIST — rich card list (1-2 items)
// ════════════════════════════════════════════

function FlatSuggestionList({
  suggestions,
  location,
  onSendMessage,
}: {
  suggestions: SuggestedPackage[];
  location?: string;
  onSendMessage?: (text: string) => void;
}) {
  const [accepted, setAccepted] = useState<Set<number>>(new Set());

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-3.5 h-3.5 text-accent-lighter" />
        <p className="text-xs font-medium text-content-tertiary">Suggested packages</p>
      </div>
      {location && (
        <p className="text-[11px] text-content-tertiary/70 mb-4">Based on PGs in {location}</p>
      )}
      {!location && <div className="mb-4" />}

      <div className="space-y-3">
        {suggestions.map((pkg, i) => {
          const isAccepted = accepted.has(i);
          const rentNum = parseRent(pkg.estimatedRent);
          return (
            <SuggestionCard
              key={pkg.name || i}
              pkg={pkg}
              rentNum={rentNum}
              isAccepted={isAccepted}
              onAccept={() => setAccepted((prev) => new Set([...prev, i]))}
            />
          );
        })}
      </div>

      {accepted.size > 0 && (
        <button
          onClick={() => {
            const selected = suggestions.filter((_, i) => accepted.has(i));
            const summary = selected
              .map((s) => `${s.name}${s.estimatedRent ? ` (${s.estimatedRent})` : ""}`)
              .join(", ");
            onSendMessage?.(`Use these ${selected.length} packages: ${summary}`);
          }}
          className={cn(BTN_PRIMARY, "mt-4")}
        >
          <span className="inline-flex items-center gap-2">
            Continue with {accepted.size} package{accepted.size > 1 ? "s" : ""}
            <ArrowRight className="w-4 h-4" />
          </span>
        </button>
      )}
    </div>
  );
}

// ════════════════════════════════════════
//  CARD STACK — one-at-a-time review (3+)
// ════════════════════════════════════════

function CardStack({
  suggestions,
  location,
  onSendMessage,
}: {
  suggestions: SuggestedPackage[];
  location?: string;
  onSendMessage?: (text: string) => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [decisions, setDecisions] = useState<Record<number, "accepted" | "skipped">>({});
  const [submitted, setSubmitted] = useState(false);

  const total = suggestions.length;
  const allReviewed = Object.keys(decisions).length === total;
  const acceptedPackages = suggestions.filter((_, i) => decisions[i] === "accepted");

  function accept() {
    setDecisions((prev) => ({ ...prev, [currentIdx]: "accepted" }));
    advanceToNext();
  }

  function skip() {
    setDecisions((prev) => ({ ...prev, [currentIdx]: "skipped" }));
    advanceToNext();
  }

  function advanceToNext() {
    for (let i = 1; i <= total; i++) {
      const nextIdx = (currentIdx + i) % total;
      if (!decisions[nextIdx]) {
        setCurrentIdx(nextIdx);
        return;
      }
    }
  }

  function handleFinalSubmit() {
    if (submitted) return;
    setSubmitted(true);
    if (acceptedPackages.length === 0) {
      onSendMessage?.("I want different packages");
      return;
    }
    const summary = acceptedPackages
      .map((s) => `${s.name}${s.estimatedRent ? ` (${s.estimatedRent})` : ""}`)
      .join(", ");
    onSendMessage?.(`Use these ${acceptedPackages.length} packages: ${summary}`);
  }

  const currentPkg = suggestions[currentIdx];
  const currentDecision = decisions[currentIdx];
  const reviewedCount = Object.keys(decisions).length;
  const rentNum = parseRent(currentPkg.estimatedRent);

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-3.5 h-3.5 text-accent-lighter" />
        <p className="text-xs font-medium text-content-tertiary">Suggested packages</p>
        {location && (
          <span className="text-[11px] text-content-tertiary/70 ml-auto">Based on {location}</span>
        )}
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-between mb-4 mt-2">
        <div className="flex gap-1">
          {suggestions.map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                decisions[i] === "accepted" && "bg-success",
                decisions[i] === "skipped" && "bg-content-tertiary",
                !decisions[i] && i === currentIdx && "bg-accent-light",
                !decisions[i] && i !== currentIdx && "bg-bg-subtle"
              )}
            />
          ))}
        </div>
        <span className="text-[11px] text-content-tertiary">
          {reviewedCount}/{total} reviewed
        </span>
      </div>

      {/* Card with navigation */}
      {!allReviewed && (
        <div className="flex items-stretch gap-2 mb-3">
          <button
            onClick={() => setCurrentIdx((currentIdx - 1 + total) % total)}
            className="flex items-center justify-center w-7 rounded-xl text-content-tertiary hover:text-content-secondary transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex-1">
            <SuggestionCard
              pkg={currentPkg}
              rentNum={rentNum}
              isAccepted={currentDecision === "accepted"}
              badge={currentDecision}
              onAccept={!currentDecision ? accept : undefined}
              onSkip={!currentDecision ? skip : undefined}
            />
          </div>

          <button
            onClick={() => setCurrentIdx((currentIdx + 1) % total)}
            className="flex items-center justify-center w-7 rounded-xl text-content-tertiary hover:text-content-secondary transition-colors flex-shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary after all reviewed */}
      {allReviewed && !submitted && (
        <div className="mb-3">
          <p className="text-xs text-content-secondary mb-2">
            {acceptedPackages.length > 0
              ? `${acceptedPackages.length} package${acceptedPackages.length !== 1 ? "s" : ""} accepted:`
              : "No packages accepted"}
          </p>
          {acceptedPackages.length > 0 && (
            <div className="space-y-2">
              {acceptedPackages.map((pkg, idx) => {
                const r = parseRent(pkg.estimatedRent);
                return (
                  <div key={pkg.name || idx} className="flex items-center gap-3 py-2.5 px-3.5 rounded-xl bg-success/5 border border-success/12">
                    <div className={cn(ICON_SM, "bg-success/12")}>
                      <Check className="w-3 h-3 text-success" />
                    </div>
                    <span className="text-sm text-content font-medium flex-1">{pkg.name}</span>
                    {r && (
                      <span className="text-sm font-semibold text-content">
                        ₹{r.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Final action */}
      {allReviewed && !submitted && (
        <button
          onClick={handleFinalSubmit}
          className={BTN_PRIMARY}
        >
          <span className="inline-flex items-center gap-2">
            {acceptedPackages.length > 0
              ? `Create ${acceptedPackages.length} package${acceptedPackages.length !== 1 ? "s" : ""}`
              : "I want different packages"}
            <ArrowRight className="w-4 h-4" />
          </span>
        </button>
      )}

      {submitted && (
        <div className="flex items-center gap-2 mt-2">
          <div className={cn(ICON_SM, "bg-success/12")}>
            <Check className="w-3 h-3 text-success" />
          </div>
          <span className="text-sm text-success font-medium">
            {acceptedPackages.length > 0 ? "Packages submitted" : "Starting fresh"}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Shared suggestion card ──

function SuggestionCard({
  pkg,
  rentNum,
  isAccepted,
  badge,
  onAccept,
  onSkip,
}: {
  pkg: SuggestedPackage;
  rentNum: number | null;
  isAccepted: boolean;
  badge?: "accepted" | "skipped";
  onAccept?: () => void;
  onSkip?: () => void;
}) {
  const foodLabel = pkg.food
    ? pkg.food.toLowerCase() === "none" ? "No meals" : `Meals ${pkg.food.toLowerCase()}`
    : null;
  const furnishLabel = pkg.furnishing
    ? String(pkg.furnishing).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all",
      isAccepted ? "border-success/25 bg-success/4" : "border-border bg-bg-elevated"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-content">{pkg.name}</p>
          {pkg.sharingType && (
            <p className="text-[11px] text-content-tertiary mt-0.5">
              {humanizeSharingType(pkg.sharingType)}
              {pkg.category ? ` · ${humanizeCategorySingular(pkg.category)}` : ""}
            </p>
          )}
          {rentNum && (
            <p className="text-xl font-bold text-content mt-1">
              <span className="text-base font-semibold text-content-secondary">₹</span>
              {rentNum.toLocaleString("en-IN")}
              <span className="text-xs text-content-tertiary font-normal ml-0.5">/month</span>
            </p>
          )}
          {!rentNum && pkg.estimatedRent && (
            <p className="text-sm font-semibold text-content mt-1">{pkg.estimatedRent}</p>
          )}
        </div>
        <div className={cn(ICON_CIRCLE, pkg.ac ? "bg-info/10" : "bg-bg-subtle")}>
          {pkg.ac ? <Snowflake className="w-4 h-4 text-info" /> : <Fan className="w-4 h-4 text-content-tertiary" />}
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4">
        <AttrChip icon={pkg.ac ? Snowflake : Fan} label={pkg.ac ? "AC" : "Non-AC"} variant={pkg.ac ? "info" : "neutral"} />
        {foodLabel && <AttrChip icon={UtensilsCrossed} label={foodLabel} variant="neutral" />}
        {furnishLabel && <AttrChip icon={Sofa} label={furnishLabel} variant="neutral" />}
      </div>

      {badge && (
        <div className="flex items-center gap-2 py-2">
          {badge === "accepted" ? (
            <>
              <div className={cn(ICON_SM, "bg-success/12")}><Check className="w-3 h-3 text-success" /></div>
              <span className="text-sm text-success font-medium">Accepted</span>
            </>
          ) : (
            <span className="text-sm text-content-tertiary font-medium">Skipped</span>
          )}
        </div>
      )}

      {!badge && !isAccepted && onAccept && !onSkip && (
        <button
          onClick={onAccept}
          className="w-full py-2.5 rounded-xl text-sm font-medium text-accent-lighter border border-accent/20 hover:bg-accent/8 transition-all active:scale-[0.98] cursor-pointer"
        >
          Accept this package
        </button>
      )}

      {!badge && !isAccepted && onAccept && onSkip && (
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-accent-lighter border border-accent/20 hover:bg-accent/8 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            Accept
          </button>
          <button
            onClick={onSkip}
            className={cn(BTN_SECONDARY, "flex-1 flex items-center justify-center gap-1.5")}
          >
            <X className="w-3.5 h-3.5" />
            Skip
          </button>
        </div>
      )}

      {isAccepted && !badge && (
        <div className="flex items-center gap-2 py-2.5">
          <div className={cn(ICON_SM, "bg-success/12")}><Check className="w-3 h-3 text-success" /></div>
          <span className="text-sm text-success font-medium">Added</span>
        </div>
      )}
    </div>
  );
}
