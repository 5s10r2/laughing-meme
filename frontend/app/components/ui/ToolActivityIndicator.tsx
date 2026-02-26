"use client";

import { Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "../../lib/cn";

interface ToolActivityIndicatorProps {
  tool: string;
  status: "running" | "complete" | "error";
  description?: string;
}

const TOOL_LABELS: Record<string, string> = {
  get_state: "Checking your progress",
  update_state: "Saving your information",
  advance_stage: "Moving to next step",
  emit_ui: "Preparing view",
};

export function ToolActivityIndicator({ tool, status, description }: ToolActivityIndicatorProps) {
  const label = description || TOOL_LABELS[tool] || `Running ${tool}`;

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1.5 px-3 rounded-lg text-xs font-medium transition-all duration-300",
        status === "running" && "text-zinc-400 bg-zinc-900/50",
        status === "complete" && "text-emerald-400/80 bg-emerald-950/20",
        status === "error" && "text-red-400/80 bg-red-950/20"
      )}
    >
      {status === "running" && (
        <Loader2 className="w-3 h-3 animate-spin text-amber-400/70" />
      )}
      {status === "complete" && (
        <Check className="w-3 h-3 text-emerald-400" />
      )}
      {status === "error" && (
        <AlertCircle className="w-3 h-3 text-red-400" />
      )}
      <span>{label}{status === "running" ? "..." : ""}</span>
    </div>
  );
}
