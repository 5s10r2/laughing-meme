"use client";

import { Check } from "lucide-react";
import { CARD } from "../ui/primitives";
import { cn } from "../../lib/cn";

interface PublishChecklistProps {
  /** human-readable reasons the property isn't publishable (from completeness.open_items) */
  items: string[];
  publishable: boolean;
}

/**
 * The honest "what's left" surface — the calm counterpart to the massing's
 * IN PROGRESS badge. Lists every open item (unmapped rooms, missing rent, empty
 * floors…), or affirms when the listing is ready. Guidance tone, never alarm.
 */
export function PublishChecklist({ items, publishable }: PublishChecklistProps) {
  if (publishable) {
    return (
      <div className={cn(CARD, "flex items-center gap-2.5")}>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
        <div>
          <p className="text-sm font-semibold text-content">Ready to publish</p>
          <p className="text-[11px] text-content-tertiary">Everything’s set — your listing can go live.</p>
        </div>
      </div>
    );
  }

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
