"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "../../lib/cn";

interface RecoveryAction {
  label: string;
  action: string;
}

interface ErrorRecoveryCardProps {
  message: string;
  actions?: RecoveryAction[];
  onSendMessage?: (text: string) => void;
}

export function ErrorRecoveryCard({ message, actions, onSendMessage }: ErrorRecoveryCardProps) {
  const defaultActions: RecoveryAction[] = actions || [
    { label: "Try again", action: "Please try again" },
    { label: "Show what's saved", action: "What do you have saved so far?" },
  ];

  return (
    <div className="border-l-2 border-amber-500/40 bg-amber-950/10 rounded-r-lg px-3.5 py-2.5 my-1.5">
      <div className="flex items-start gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-200/80">{message}</p>
      </div>
      <div className="flex flex-wrap gap-2 pl-6">
        {defaultActions.map((action) => (
          <button
            key={action.label}
            onClick={() => onSendMessage?.(action.action)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-medium",
              "bg-amber-500/10 text-amber-300 border border-amber-500/20",
              "hover:bg-amber-500/20 active:scale-95 transition-all duration-150"
            )}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
