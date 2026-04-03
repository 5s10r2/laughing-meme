"use client";

import { AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "../../../lib/cn";

interface PendingItem {
  id: string;
  description: string;
  stage: string;
  fixAction?: string;
}

interface PendingItemsListProps {
  items: PendingItem[];
  onSendMessage?: (text: string) => void;
}

export function PendingItemsList({
  items,
  onSendMessage,
}: PendingItemsListProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="border border-accent/30 bg-accent/5 rounded-[var(--radius-card)] px-4 py-3.5 my-2">
      <div className="flex items-center gap-2 mb-2.5">
        <AlertCircle className="w-3.5 h-3.5 text-accent-light" />
        <span className="text-xs font-semibold text-accent-lighter">
          {items.length} quick fix{items.length !== 1 ? "es" : ""} remaining
        </span>
      </div>

      <p className="text-xs text-content-secondary mb-3">
        Let&apos;s take care of these before going live:
      </p>

      <div className="space-y-1.5">
        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() =>
              onSendMessage?.(
                item.fixAction || `Fix: ${item.description}`
              )
            }
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-button)] text-left",
              "bg-bg-elevated border border-border",
              "hover:bg-bg-elevated hover:border-border transition-all",
              "active:scale-[0.98]"
            )}
          >
            <span className="w-5 h-5 rounded-full bg-accent/10 text-accent-light text-xs font-bold flex items-center justify-center flex-shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-content truncate">
                {item.fixAction || item.description}
              </p>
              <p className="text-xs text-content-tertiary capitalize">
                {item.stage} stage
              </p>
            </div>
            <ChevronRight className="w-3 h-3 text-content-tertiary flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
