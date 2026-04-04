"use client";

import { AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "../../../lib/cn";
import {
  ICON_SM,
} from "../../ui/primitives";

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
    <div className="bg-warning/5 border border-warning/15 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-4 h-4 text-warning" />
        <p className="text-sm font-medium text-content">
          {items.length} item{items.length !== 1 ? "s" : ""} to resolve
        </p>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() =>
              onSendMessage?.(
                item.fixAction || `Fix: ${item.description}`
              )
            }
            className="w-full flex items-center gap-3 py-3 px-4 rounded-xl bg-bg-surface/50 border border-border hover:bg-bg-elevated transition-all cursor-pointer text-left active:scale-[0.98]"
          >
            <div className={cn(ICON_SM, "bg-warning/12 text-[11px] font-bold text-warning")}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-content">
                {item.fixAction || item.description}
              </p>
              <p className="text-[11px] text-content-tertiary mt-0.5 capitalize">
                {item.stage}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-content-tertiary flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
