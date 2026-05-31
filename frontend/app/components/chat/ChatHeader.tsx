"use client";

import { StageProgressBar } from "../ui/StageProgressBar";

interface ChatHeaderProps {
  onNewSession: () => void;
  isStreaming: boolean;
  /** Legacy linear stage rail. Off in the Living Blueprint experience, where the
   *  massing model is the progress portrait and onboarding is non-linear. */
  showStageProgress?: boolean;
}

export function ChatHeader({ onNewSession, isStreaming, showStageProgress = true }: ChatHeaderProps) {
  return (
    <header className="border-b border-border">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold text-sm">
            T
          </div>
          <div>
            <h1 className="font-semibold text-content leading-tight">
              Tarini
            </h1>
            <p className="text-xs text-content-tertiary">
              RentOK Property Onboarding
            </p>
          </div>
        </div>
        <button
          onClick={onNewSession}
          disabled={isStreaming}
          className="text-xs text-content-tertiary hover:text-content-secondary transition-colors disabled:opacity-40"
        >
          New session
        </button>
      </div>
      {/* Stage progress bar — legacy only */}
      {showStageProgress && (
        <div className="px-6 pb-3">
          <StageProgressBar />
        </div>
      )}
    </header>
  );
}
