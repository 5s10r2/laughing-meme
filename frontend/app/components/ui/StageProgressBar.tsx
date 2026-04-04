"use client";

import { Check } from "lucide-react";
import { cn } from "../../lib/cn";
import { useOnboardingState } from "../../context/OnboardingStateContext";
import type { Stage } from "../../lib/types";

/**
 * Connected capsule-style progress bar.
 * Inspired by the RentOk designer's Figma: numbered circles connected by
 * a progress track, with stage labels below each step.
 */

const STAGES: { key: Stage; label: string }[] = [
  { key: "intro", label: "Intro" },
  { key: "structure", label: "Structure" },
  { key: "packages", label: "Packages" },
  { key: "mapping", label: "Mapping" },
  { key: "verification", label: "Verify" },
];

const STAGE_ORDER: Stage[] = ["intro", "structure", "packages", "mapping", "verification"];

function getStageIndex(stage: Stage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function StageProgressBar() {
  const { sessionState } = useOnboardingState();
  const currentIndex = getStageIndex(sessionState.stage);

  return (
    <div className="relative flex items-start justify-between px-2 py-3">
      {/* Background track */}
      <div className="absolute top-[17px] left-[22px] right-[22px] h-[2px] bg-bg-subtle rounded-full" />
      {/* Progress fill */}
      <div
        className="absolute top-[17px] left-[22px] h-[2px] bg-success/40 rounded-full transition-all duration-500"
        style={{ width: `calc(${(currentIndex / (STAGES.length - 1)) * 100}% - 44px * ${currentIndex / (STAGES.length - 1)})` }}
      />

      {STAGES.map((stage, i) => {
        const isComplete = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={stage.key} className="flex flex-col items-center z-10 w-10">
            {/* Circle */}
            <div
              className={cn(
                "flex items-center justify-center rounded-full transition-all duration-300",
                "w-7 h-7 text-[11px] font-bold",
                isComplete && "bg-success text-white",
                isCurrent && "bg-accent text-white ring-2 ring-accent/25",
                !isComplete && !isCurrent && "bg-bg-subtle text-content-tertiary"
              )}
            >
              {isComplete ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                i + 1
              )}
            </div>
            {/* Label */}
            <span
              className={cn(
                "text-[9px] font-medium mt-1.5 text-center leading-tight",
                isComplete && "text-success",
                isCurrent && "text-accent-lighter",
                !isComplete && !isCurrent && "text-content-tertiary"
              )}
            >
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
