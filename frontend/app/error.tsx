"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Onboarding UI crashed:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-4">
        <p className="text-sm text-content font-medium">Something went wrong.</p>
        <p className="text-xs text-content-tertiary">
          The onboarding assistant hit an unexpected error. Your progress is saved — you can
          retry without losing anything.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-bg-elevated transition-colors cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
