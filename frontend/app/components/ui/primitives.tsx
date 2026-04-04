"use client";

/**
 * Shared design primitives for Tarini's component system.
 * All components import from here — single source of truth for visual patterns.
 */

import type { LucideIcon } from "lucide-react";
import { SquarePen } from "lucide-react";
import { cn } from "../../lib/cn";

// ─── Card Classes ───────────────────────────────────────────────────

export const CARD = "bg-bg-surface border border-border rounded-2xl p-5";
export const CARD_TIGHT = "bg-bg-surface border border-border rounded-2xl p-4";
export const CARD_DIVIDER = "border-b border-border";

// ─── Pill Classes ───────────────────────────────────────────────────

export const PILL = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium";
export const PILL_NEUTRAL = cn(PILL, "bg-bg-elevated text-content-secondary");
export const PILL_SUCCESS = cn(PILL, "bg-success/10 text-success");
export const PILL_ACCENT = cn(PILL, "bg-accent/10 text-accent-lighter");
export const PILL_WARNING = cn(PILL, "bg-warning/10 text-warning");
export const PILL_ERROR = cn(PILL, "bg-error/10 text-error");

// ─── Button Classes ─────────────────────────────────────────────────

export const BTN_PRIMARY = "w-full py-3 rounded-xl text-sm font-semibold bg-accent hover:bg-accent-light text-white transition-all active:scale-[0.98] cursor-pointer";
export const BTN_SECONDARY = "py-2.5 px-4 rounded-xl text-sm font-medium text-content-secondary border border-border hover:bg-bg-elevated transition-all active:scale-[0.98] cursor-pointer";
export const BTN_GHOST = "py-2.5 px-4 rounded-xl text-sm font-medium text-accent-lighter hover:bg-accent/8 transition-all active:scale-[0.98] cursor-pointer";

// ─── Icon Container Classes ─────────────────────────────────────────

export const ICON_CIRCLE = "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0";
export const ICON_SM = "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0";

// ─── Reusable Components ────────────────────────────────────────────

export function EditButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded-full flex items-center justify-center text-content-tertiary hover:text-accent-lighter hover:bg-bg-elevated transition-all cursor-pointer"
      aria-label="Edit"
    >
      <SquarePen className="w-3.5 h-3.5" />
    </button>
  );
}

type ChipVariant = "neutral" | "accent" | "info" | "success" | "warning";

const CHIP_STYLES: Record<ChipVariant, string> = {
  neutral: "bg-bg-elevated text-content-secondary",
  accent: "bg-accent/10 text-accent-lighter",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
};

export function AttrChip({
  icon: Icon,
  label,
  variant = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  variant?: ChipVariant;
}) {
  return (
    <span className={cn(PILL, CHIP_STYLES[variant])}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
