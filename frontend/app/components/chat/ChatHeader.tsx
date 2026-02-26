"use client";

import { StageProgressBar } from "../ui/StageProgressBar";

interface ChatHeaderProps {
  onNewSession: () => void;
  isStreaming: boolean;
}

export function ChatHeader({ onNewSession, isStreaming }: ChatHeaderProps) {
  return (
    <header className="border-b border-zinc-800">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-zinc-950 font-bold text-sm">
            T
          </div>
          <div>
            <h1 className="font-semibold text-zinc-100 leading-tight">
              Tarini
            </h1>
            <p className="text-xs text-zinc-500">
              RentOK Property Onboarding
            </p>
          </div>
        </div>
        <button
          onClick={onNewSession}
          disabled={isStreaming}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
        >
          New session
        </button>
      </div>
      {/* Stage progress bar */}
      <div className="px-6 pb-3">
        <StageProgressBar />
      </div>
    </header>
  );
}
