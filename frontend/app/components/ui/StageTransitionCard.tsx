"use client";

import { ArrowRight, Check } from "lucide-react";
import { cn } from "../../lib/cn";
import {
  CARD, CARD_DIVIDER, ICON_SM, BTN_PRIMARY,
} from "./primitives";

const STAGE_LABELS: Record<string, string> = {
  intro: "Introduction",
  structure: "Property Structure",
  packages: "Rental Packages",
  mapping: "Room Mapping",
  verification: "Verification",
};

const STAGE_DESCRIPTIONS: Record<string, string> = {
  structure: "Define floors, rooms, and naming",
  packages: "Set up what you'll offer tenants",
  mapping: "Assign each room its rental package",
  verification: "Review everything before going live",
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
    <div className="bg-bg-surface border border-border rounded-2xl overflow-hidden">
      {/* Completed stage */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={cn(ICON_SM, "bg-success/12")}>
            <Check className="w-3.5 h-3.5 text-success" />
          </div>
          <div>
            <p className="text-xs text-content-tertiary">Completed</p>
            <p className="text-sm font-medium text-content">
              {STAGE_LABELS[completedStage] || completedStage}
            </p>
          </div>
        </div>
        {summary && (
          <p className="text-xs text-content-secondary mt-1.5 pl-9">{summary}</p>
        )}
      </div>

      {/* Next stage */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={cn(ICON_SM, "bg-accent/12")}>
            <ArrowRight className="w-3.5 h-3.5 text-accent-lighter" />
          </div>
          <div>
            <p className="text-xs text-content-tertiary">Next up</p>
            <p className="text-sm font-medium text-content">
              {STAGE_LABELS[nextStage] || nextStage}
            </p>
            {STAGE_DESCRIPTIONS[nextStage] && (
              <p className="text-[11px] text-content-tertiary mt-0.5">
                {STAGE_DESCRIPTIONS[nextStage]}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
