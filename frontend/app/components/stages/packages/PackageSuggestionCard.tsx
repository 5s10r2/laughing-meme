"use client";

import { useState } from "react";
import { Sparkles, Snowflake, Fan, ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { cn } from "../../../lib/cn";
import { humanizeSharingType, humanizeCategorySingular } from "../../../lib/property-utils";

interface SuggestedPackage {
  name: string;
  sharingType?: string;
  ac: boolean;
  estimatedRent?: string;
  category?: string;
}

interface PackageSuggestionCardProps {
  suggestions: SuggestedPackage[];
  location?: string;
  onSendMessage?: (text: string) => void;
}

/** Threshold at which we switch from flat list to card stack */
const STACK_THRESHOLD = 3;

export function PackageSuggestionCard({
  suggestions: rawSuggestions,
  location,
  onSendMessage,
  ...rest
}: PackageSuggestionCardProps & Record<string, unknown>) {
  // Defensive: handle missing/malformed suggestions from Claude
  const rawList = Array.isArray(rawSuggestions)
    ? rawSuggestions
    : rawSuggestions && typeof rawSuggestions === "object"
      ? Object.values(rawSuggestions as Record<string, unknown>).map((v) => {
          if (typeof v === "object" && v !== null) return v as SuggestedPackage;
          return { name: String(v), ac: false };
        })
      : [];

  const parsedSuggestions: SuggestedPackage[] = (
    rawList.length > 0
      ? rawList
      : Array.isArray((rest as Record<string, unknown>).packages)
        ? ((rest as Record<string, unknown>).packages as unknown[])
        : []
  ).map((raw: unknown) => {
    const p = raw as Record<string, unknown>;
    return {
      name: (p.name || p.package_name || p.packageName || "Package") as string,
      sharingType: (p.sharingType || p.sharing_type) as string | undefined,
      ac: Boolean(p.ac),
      estimatedRent: (p.estimatedRent || p.estimated_rent || p.rent) as string | undefined,
      category: (p.category || p.type || p.unit_type) as string | undefined,
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
//  FLAT LIST — simple inline list (1-2 items)
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
  return (
    <div className="border border-border border-l-2 border-l-accent/30 bg-bg-surface rounded-[var(--radius-card)] px-4 py-3.5 my-2">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-accent-light" />
        <span className="text-xs font-semibold text-content">Suggested Packages</span>
        {location && (
          <span className="text-xs text-content-tertiary ml-auto">Based on {location}</span>
        )}
      </div>

      <div className="space-y-1.5 mb-3">
        {suggestions.map((pkg, idx) => (
          <PackageRow key={pkg.name || idx} pkg={pkg} />
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t border-border">
        <button
          onClick={() => {
            const summary = suggestions
              .map((s) => `${s.name}${s.estimatedRent ? ` (${s.estimatedRent})` : ""}`)
              .join(", ");
            onSendMessage?.(
              `Use these ${suggestions.length} packages: ${summary}`
            );
          }}
          className={cn(
            "flex-1 px-3 py-2.5 rounded-[var(--radius-button)] text-[13px] font-semibold",
            "bg-accent/10 text-accent-lighter border border-accent/30",
            "hover:bg-accent/15 active:scale-95 transition-all"
          )}
        >
          Use all {suggestions.length} package{suggestions.length !== 1 ? "s" : ""} →
        </button>
        <button
          onClick={() => onSendMessage?.("I want different packages")}
          className="px-3 py-1.5 rounded-[var(--radius-button)] text-xs font-medium text-content-secondary border border-border hover:bg-bg-elevated active:scale-95 transition-all"
        >
          I want different packages
        </button>
      </div>
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
    // Find next unreviewed
    for (let i = 1; i <= total; i++) {
      const nextIdx = (currentIdx + i) % total;
      if (!decisions[nextIdx]) {
        setCurrentIdx(nextIdx);
        return;
      }
    }
    // All reviewed — stay on current
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

  return (
    <div className="border border-border border-l-2 border-l-accent/30 bg-bg-surface rounded-[var(--radius-card)] px-4 py-3.5 my-2">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-accent-light" />
        <span className="text-xs font-semibold text-content">Suggested Packages</span>
        {location && (
          <span className="text-xs text-content-tertiary ml-auto">Based on {location}</span>
        )}
      </div>

      {/* ── Progress indicator ── */}
      <div className="flex items-center justify-between mb-2">
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

      {/* ── Card with navigation ── */}
      {!allReviewed && (
        <div className="flex items-stretch gap-2 mb-3">
          {/* Left arrow */}
          <button
            onClick={() => setCurrentIdx((currentIdx - 1 + total) % total)}
            className="flex items-center justify-center w-7 rounded-[var(--radius-button)] text-content-tertiary hover:text-content-secondary transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Card */}
          <div className="flex-1 px-3 py-3 rounded-[var(--radius-card)] bg-bg-elevated border border-border">
            <div className="flex items-center gap-2 mb-2">
              {currentPkg.ac ? (
                <Snowflake className="w-3.5 h-3.5 text-info" />
              ) : (
                <Fan className="w-3.5 h-3.5 text-content-tertiary" />
              )}
              <span className="text-sm text-content font-semibold">{currentPkg.name}</span>
              {currentDecision && (
                <span
                  className={cn(
                    "ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium",
                    currentDecision === "accepted"
                      ? "bg-success-surface text-success"
                      : "bg-bg-subtle text-content-tertiary"
                  )}
                >
                  {currentDecision === "accepted" ? "Accepted" : "Skipped"}
                </span>
              )}
            </div>

            <div className="space-y-1 text-xs">
              {currentPkg.sharingType && (
                <div className="flex justify-between">
                  <span className="text-content-tertiary">Type</span>
                  <span className="text-content-secondary">{humanizeSharingType(currentPkg.sharingType)}</span>
                </div>
              )}
              {currentPkg.category && (
                <div className="flex justify-between">
                  <span className="text-content-tertiary">Category</span>
                  <span className="text-content-secondary">{humanizeCategorySingular(currentPkg.category)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-content-tertiary">AC</span>
                <span className="text-content-secondary">{currentPkg.ac ? "Yes" : "No"}</span>
              </div>
              {currentPkg.estimatedRent && (
                <div className="flex justify-between">
                  <span className="text-content-tertiary">Rent</span>
                  <span className="text-content font-semibold">{currentPkg.estimatedRent}</span>
                </div>
              )}
            </div>

            {/* Per-card actions */}
            {!currentDecision && (
              <div className="flex gap-2 mt-3 pt-2 border-t border-border">
                <button
                  onClick={accept}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-[var(--radius-button)] text-xs font-semibold",
                    "bg-accent/10 text-accent-lighter border border-accent/30",
                    "hover:bg-accent/15 active:scale-95 transition-all"
                  )}
                >
                  <Check className="w-3 h-3" />
                  Accept
                </button>
                <button
                  onClick={skip}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-[var(--radius-button)] text-xs font-medium",
                    "text-content-secondary border border-border",
                    "hover:bg-bg-elevated active:scale-95 transition-all"
                  )}
                >
                  <X className="w-3 h-3" />
                  Skip
                </button>
              </div>
            )}
          </div>

          {/* Right arrow */}
          <button
            onClick={() => setCurrentIdx((currentIdx + 1) % total)}
            className="flex items-center justify-center w-7 rounded-[var(--radius-button)] text-content-tertiary hover:text-content-secondary transition-colors flex-shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Summary after all reviewed ── */}
      {allReviewed && !submitted && (
        <div className="mb-3">
          <p className="text-xs text-content-secondary mb-2">
            {acceptedPackages.length > 0
              ? `${acceptedPackages.length} package${acceptedPackages.length !== 1 ? "s" : ""} accepted:`
              : "No packages accepted"}
          </p>
          {acceptedPackages.length > 0 && (
            <div className="space-y-1">
              {acceptedPackages.map((pkg, idx) => (
                <PackageRow key={pkg.name || idx} pkg={pkg} compact />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Final action ── */}
      {allReviewed && !submitted && (
        <div className="pt-2 border-t border-border">
          <button
            onClick={handleFinalSubmit}
            className={cn(
              "w-full px-3 py-2.5 rounded-[var(--radius-button)] text-[13px] font-semibold",
              "bg-accent/10 text-accent-lighter border border-accent/30",
              "hover:bg-accent/15 active:scale-95 transition-all"
            )}
          >
            {acceptedPackages.length > 0
              ? `Create ${acceptedPackages.length} package${acceptedPackages.length !== 1 ? "s" : ""} →`
              : "I want different packages →"}
          </button>
        </div>
      )}

      {submitted && (
        <p className="text-xs text-success font-medium mt-2">
          {acceptedPackages.length > 0 ? "Packages submitted" : "Starting fresh"}
        </p>
      )}
    </div>
  );
}

// ── Shared row renderer ──

function PackageRow({ pkg, compact }: { pkg: SuggestedPackage; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-[var(--radius-button)] bg-bg-elevated border border-border",
        compact ? "px-2.5 py-1.5" : "px-3 py-2"
      )}
    >
      <div className="flex items-center gap-2">
        {pkg.ac ? (
          <Snowflake className="w-3 h-3 text-info" />
        ) : (
          <Fan className="w-3 h-3 text-content-tertiary" />
        )}
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-content font-medium">{pkg.name}</p>
            {pkg.category && (
              <span className="px-1.5 py-0.5 rounded bg-bg-subtle text-[10px] font-medium text-content-secondary">
                {humanizeCategorySingular(pkg.category)}
              </span>
            )}
          </div>
          {pkg.sharingType && !compact && (
            <p className="text-[11px] text-content-tertiary">{humanizeSharingType(pkg.sharingType)}</p>
          )}
        </div>
      </div>
      {pkg.estimatedRent && (
        <span className={cn("font-semibold text-content", compact ? "text-xs" : "text-sm")}>
          {pkg.estimatedRent}
        </span>
      )}
    </div>
  );
}
