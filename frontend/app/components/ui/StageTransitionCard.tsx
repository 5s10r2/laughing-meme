"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/cn";

const STAGE_LABELS: Record<string, string> = {
  intro: "Introduction",
  structure: "Property Structure",
  packages: "Rental Packages",
  mapping: "Room Mapping",
  verification: "Verification",
};

const STAGE_DESCRIPTIONS: Record<string, string> = {
  structure: "We'll set up your floors and rooms",
  packages: "We'll define your rental options",
  mapping: "We'll connect rooms to packages",
  verification: "We'll review everything together",
};

interface StageTransitionCardProps {
  completedStage: string;
  nextStage: string;
  summary?: string;
  onSendMessage?: (text: string) => void;
}

export function StageTransitionCard({
  completedStage,
  nextStage,
  summary,
  onSendMessage,
}: StageTransitionCardProps) {
  return (
    <div className="bg-gradient-to-r from-zinc-900 to-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3.5 my-2">
      {/* Completed stage */}
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-medium text-emerald-300/90">
          {STAGE_LABELS[completedStage] || completedStage} complete
        </span>
      </div>

      {summary && (
        <p className="text-xs text-zinc-400 mb-3 pl-6">{summary}</p>
      )}

      {/* Divider */}
      <div className="border-t border-zinc-800 my-2" />

      {/* Next stage */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
          <div>
            <p className="text-xs font-semibold text-zinc-200">
              Next: {STAGE_LABELS[nextStage] || nextStage}
            </p>
            {STAGE_DESCRIPTIONS[nextStage] && (
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {STAGE_DESCRIPTIONS[nextStage]}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => onSendMessage?.(`Let's continue to ${nextStage}`)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-amber-500/15 text-amber-300 border border-amber-500/25",
            "hover:bg-amber-500/25 hover:border-amber-500/40",
            "active:scale-95 transition-all duration-150"
          )}
        >
          Continue to {STAGE_LABELS[nextStage] || nextStage} →
        </button>
      </div>
    </div>
  );
}
