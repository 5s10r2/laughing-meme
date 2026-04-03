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
    <div className="border-l-2 border-accent/40 bg-accent/5 rounded-r-lg px-3.5 py-2.5 my-1.5">
      <div className="flex items-start gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-accent-light flex-shrink-0 mt-0.5" />
        <p className="text-xs text-accent-lighter">{message}</p>
      </div>
      <div className="flex flex-wrap gap-2 pl-6">
        {defaultActions.map((action) => (
          <button
            key={action.label}
            onClick={() => onSendMessage?.(action.action)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium",
              "bg-accent/10 text-accent-lighter border border-accent/30",
              "hover:bg-accent/20 active:scale-95 transition-all duration-150"
            )}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
