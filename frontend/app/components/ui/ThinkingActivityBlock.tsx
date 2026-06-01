"use client";

import { useState } from "react";
import { Loader2, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ToolActivityPart } from "../../lib/types";
import { cn } from "../../lib/cn";

interface ThinkingActivityBlockProps {
  parts: ToolActivityPart[];
  isStreaming: boolean;
}

const TOOL_PHRASES: Record<string, string> = {
  get_state: "Checking your progress",
  update_state: "Saving your information",
  advance_stage: "Moving to the next step",
  emit_ui: "Preparing your view",
  validate_property_data: "Checking your property details",
  create_packages: "Setting up your packages",
  map_rooms: "Mapping your rooms",
  verify_setup: "Verifying your setup",
};

function toHumanPhrase(part: ToolActivityPart): string {
  return TOOL_PHRASES[part.tool] ?? part.tool.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ThinkingActivityBlock({ parts, isStreaming }: ThinkingActivityBlockProps) {
  const [expanded, setExpanded] = useState(false);

  // Clears from transcript when streaming ends — keeps the history clean
  if (!isStreaming || parts.length === 0) return null;

  const running = parts.find((p) => p.toolStatus === "running");
  const currentLabel = running ? toHumanPhrase(running) : "Working";
  const hasHistory = parts.length > 1;

  return (
    <div className="my-1 rounded-lg border border-border bg-bg-surface overflow-hidden">
      <button
        onClick={() => hasHistory && setExpanded((e) => !e)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
          hasHistory ? "hover:bg-bg-elevated cursor-pointer" : "cursor-default"
        )}
      >
        <Loader2 className="w-3.5 h-3.5 text-accent-lighter animate-spin flex-shrink-0" />
        <span className="flex-1 text-xs text-content-secondary">{currentLabel}…</span>
        {hasHistory && (
          expanded
            ? <ChevronUp className="w-3 h-3 text-content-tertiary flex-shrink-0" />
            : <ChevronDown className="w-3 h-3 text-content-tertiary flex-shrink-0" />
        )}
      </button>

      {expanded && hasHistory && (
        <div className="px-3 pb-2 pt-0.5 border-t border-border space-y-1">
          {parts.map((p, i) => (
            <div key={p.toolId || i} className="flex items-center gap-2">
              {p.toolStatus === "running" ? (
                <Loader2 className="w-3 h-3 text-accent-lighter animate-spin flex-shrink-0" />
              ) : (
                <Check className="w-3 h-3 text-success flex-shrink-0" />
              )}
              <span className={cn(
                "text-[11px]",
                p.toolStatus === "running" ? "text-content-secondary" : "text-content-tertiary"
              )}>
                {toHumanPhrase(p)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
