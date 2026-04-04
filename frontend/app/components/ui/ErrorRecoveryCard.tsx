"use client";

import { AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "../../lib/cn";
import {
  ICON_CIRCLE, BTN_PRIMARY, BTN_SECONDARY,
} from "./primitives";

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
    <div className="bg-error/5 border border-error/15 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(ICON_CIRCLE, "bg-error/10")}>
          <AlertTriangle className="w-4 h-4 text-error" />
        </div>
        <div>
          <p className="text-sm font-semibold text-content">Something went wrong</p>
          <p className="text-xs text-content-tertiary mt-0.5">{message}</p>
        </div>
      </div>
      <div className="flex gap-2.5 mt-4">
        <button
          onClick={() => onSendMessage?.(defaultActions.find((a) => a.label.toLowerCase().includes("show") || a.label.toLowerCase().includes("saved"))?.action || defaultActions[1]?.action || "What do you have saved?")}
          className={cn(BTN_SECONDARY, "flex-1")}
        >
          {defaultActions.find((a) => a.label.toLowerCase().includes("show") || a.label.toLowerCase().includes("saved"))?.label || "Show what's saved"}
        </button>
        <button
          onClick={() => onSendMessage?.(defaultActions.find((a) => a.label.toLowerCase().includes("try") || a.label.toLowerCase().includes("again"))?.action || defaultActions[0]?.action || "Please try again")}
          className={cn(BTN_PRIMARY, "flex-1 bg-error hover:bg-error/80")}
        >
          <span className="inline-flex items-center gap-2">
            {defaultActions.find((a) => a.label.toLowerCase().includes("try") || a.label.toLowerCase().includes("again"))?.label || "Try again"}
            <ArrowRight className="w-4 h-4" />
          </span>
        </button>
      </div>
    </div>
  );
}
