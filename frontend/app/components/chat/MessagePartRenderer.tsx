"use client";

import type { MessagePart } from "../../lib/types";
import { renderRegisteredComponent } from "../../lib/component-registry";
import { ToolActivityIndicator } from "../ui/ToolActivityIndicator";
import { renderInlineMarkdown } from "../../lib/render-markdown";

interface MessagePartRendererProps {
  part: MessagePart;
  sendMessage?: (text: string) => void;
}

/**
 * Renders a single MessagePart based on its type.
 *
 * - "text"           → whitespace-preserving text span
 * - "component"      → looked up in the component registry
 * - "tool_activity"  → ToolActivityIndicator with status
 */
export function MessagePartRenderer({ part, sendMessage }: MessagePartRendererProps) {
  switch (part.type) {
    case "text":
      if (!part.text) return null;
      return (
        <span className="whitespace-pre-wrap">
          {renderInlineMarkdown(part.text)}
        </span>
      );

    case "component": {
      const rendered = renderRegisteredComponent(
        part.componentName,
        part.props,
        sendMessage
      );
      if (!rendered) {
        // Fallback: subtle em-dash instead of blank space
        return <span className="text-zinc-700">&mdash;</span>;
      }
      return <div className="my-1">{rendered}</div>;
    }

    case "tool_activity":
      return (
        <div className="my-1">
          <ToolActivityIndicator
            tool={part.tool}
            status={part.toolStatus}
            description={part.toolDescription}
          />
        </div>
      );

    default:
      return null;
  }
}
