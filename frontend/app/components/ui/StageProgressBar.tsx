"use client";

import { Check } from "lucide-react";
import { cn } from "../../lib/cn";
import { useOnboardingState } from "../../context/OnboardingStateContext";
import type { Stage } from "../../lib/types";

const STAGES: { key: Stage; label: string; shortLabel: string }[] = [
  { key: "intro", label: "Intro", shortLabel: "1" },
  { key: "structure", label: "Structure", shortLabel: "2" },
  { key: "packages", label: "Packages", shortLabel: "3" },
  { key: "mapping", label: "Mapping", shortLabel: "4" },
  { key: "verification", label: "Verify", shortLabel: "5" },
];

const STAGE_ORDER: Stage[] = ["intro", "structure", "packages", "mapping", "verification"];

function getStageIndex(stage: Stage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function StageProgressBar() {
  const { sessionState } = useOnboardingState();
  const currentIndex = getStageIndex(sessionState.stage);

  return (
    <div className="flex items-center gap-1">
      {STAGES.map((stage, i) => {
        const isComplete = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isFuture = i > currentIndex;

        return (
          <div key={stage.key} className="flex items-center">
            {/* Node */}
            <div
              className={cn(
                "flex items-center justify-center rounded-full transition-all duration-300",
                "w-5 h-5 text-[11px] font-bold",
                isComplete && "bg-success/20 text-success",
                isCurrent && "bg-accent/25 text-accent-lighter ring-1 ring-accent/40",
                isFuture && "bg-bg-subtle text-content-tertiary"
              )}
              title={stage.label}
            >
              {isComplete ? (
                <Check className="w-2.5 h-2.5" />
              ) : (
                stage.shortLabel
              )}
            </div>

            {/* Connector line */}
            {i < STAGES.length - 1 && (
              <div
                className={cn(
                  "w-3 h-px mx-0.5",
                  i < currentIndex ? "bg-success/30" : "bg-bg-subtle"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
