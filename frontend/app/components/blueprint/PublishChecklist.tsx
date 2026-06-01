"use client";

import { Check } from "lucide-react";
import { CARD } from "../ui/primitives";
import { cn } from "../../lib/cn";

interface PublishChecklistProps {
  /** human-readable reasons the property isn't publishable (from completeness.open_items) */
  items: string[];
  publishable: boolean;
  /** The listing has been published — show the celebration state instead of the CTA. */
  published?: boolean;
  /** Called when the operator taps "Publish my listing". Should close the panel and
   *  send the publish intent to Tarini so the AI confirms and executes the publish. */
  onPublish?: () => void;
}

/**
 * The listing-readiness surface — three distinct states in priority order:
 *
 *  1. published=true   → "You're live ✓"  — the completion moment
 *  2. publishable=true → "Ready to publish" + a Publish CTA that fires onPublish
 *  3. open items       → "Before you publish" — honest list of what's missing
 */
export function PublishChecklist({ items, publishable, published, onPublish }: PublishChecklistProps) {
  // 1 — The listing is live: celebrate.
  if (published) {
    return (
      <div className={cn(CARD, "border-success/30 bg-success/[0.04]")}>
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
          <div>
            <p className="text-sm font-semibold text-content">You're live ✓</p>
            <p className="text-[11px] text-content-secondary mt-0.5">
              Your listing is published and visible to operators on RentOK.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2 — Everything is complete: show a clear Publish CTA.
  if (publishable) {
    return (
      <div className={cn(CARD, "space-y-3")}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <div>
            <p className="text-sm font-semibold text-content">Ready to publish</p>
            <p className="text-[11px] text-content-tertiary">
              Everything's set — tap below and Tarini will take it live.
            </p>
          </div>
        </div>
        {onPublish && (
          <button
            type="button"
            onClick={onPublish}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white cursor-pointer hover:bg-accent/90 active:scale-[0.98] transition-all"
          >
            Publish my listing
          </button>
        )}
      </div>
    );
  }

  // 3 — Open items remain: honest list. Guidance tone, never alarm.
  if (items.length === 0) return null;

  return (
    <div className={CARD}>
      <p className="mb-2 text-sm font-semibold text-content">Before you publish</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-content-secondary">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
