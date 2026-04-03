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
  validate_property_data: "Validating property data",
  create_packages: "Creating packages",
  map_rooms: "Mapping rooms",
  verify_setup: "Verifying setup",
};

/** Convert snake_case tool name to Title Case for display */
function formatToolName(tool: string): string {
  return tool
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ToolActivityIndicator({ tool, status, description }: ToolActivityIndicatorProps) {
  const label = description || TOOL_LABELS[tool] || formatToolName(tool);

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1.5 px-3 rounded-lg text-xs font-medium transition-all duration-300",
        status === "running" && "text-content-secondary bg-bg-surface",
        status === "complete" && "text-success/80 bg-success-surface",
        status === "error" && "text-error/80 bg-error-surface"
      )}
    >
      {status === "running" && (
        <Loader2 className="w-3 h-3 animate-spin text-accent-light/70" />
      )}
      {status === "complete" && (
        <Check className="w-3 h-3 text-success" />
      )}
      {status === "error" && (
        <AlertCircle className="w-3 h-3 text-error" />
      )}
      <span>{label}{status === "running" ? "..." : ""}</span>
    </div>
  );
}
