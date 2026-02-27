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
    <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl px-4 py-3.5 my-2">
      <div className="flex items-center gap-2 mb-2.5">
        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-semibold text-amber-300">
          {items.length} item{items.length !== 1 ? "s" : ""} need attention
        </span>
      </div>

      <p className="text-[11px] text-zinc-400 mb-3">
        Fix these issues before confirming your property setup.
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
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left",
              "bg-zinc-800/40 border border-zinc-800",
              "hover:bg-zinc-800/60 hover:border-zinc-700 transition-all",
              "active:scale-[0.98]"
            )}
          >
            <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300 truncate">
                {item.fixAction || item.description}
              </p>
              <p className="text-[10px] text-zinc-600 capitalize">
                {item.stage} stage
              </p>
            </div>
            <ChevronRight className="w-3 h-3 text-zinc-600 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
