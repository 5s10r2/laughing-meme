"use client";

import type { Message, ToolActivityPart } from "../../lib/types";
import { MessagePartRenderer } from "./MessagePartRenderer";
import { ThinkingActivityBlock } from "../ui/ThinkingActivityBlock";

interface MessageBubbleProps {
  message: Message;
  sendMessage?: (text: string) => void;
}

/**
 * Renders a single message bubble.
 *
 * For Tarini messages, renders all parts sequentially (text blocks,
 * component blocks, tool indicators). Text parts inside the bubble
 * get the standard text styling. Component and tool_activity parts
 * render as their own visual elements within the bubble flow.
 *
 * For user messages, renders a simple text bubble.
 */
export function MessageBubble({ message, sendMessage }: MessageBubbleProps) {
  // "event" — a system note (e.g. a direct Blueprint edit): centered, muted, no avatar/bubble.
  if (message.role === "event") {
    const text = message.parts
      .filter((p) => p.type === "text")
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("");
    if (!text) return null;
    return (
      <div className="flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-subtle px-3 py-1 text-[11px] text-content-tertiary">
          <span aria-hidden="true">✏️</span>
          {text}
        </span>
      </div>
    );
  }

  const isTarini = message.role === "tarini";
  const toolParts = message.parts.filter((p): p is ToolActivityPart => p.type === "tool_activity");
  const contentParts = message.parts.filter((p) => p.type !== "tool_activity");
  const lastComponentIdx = contentParts.reduce((acc, p, i) => (p.type === "component" ? i : acc), -1);
  const hasContent = message.parts.length > 0 && message.parts.some(
    (p) => (p.type === "text" && p.text) || p.type === "component" || p.type === "tool_activity"
  );

  return (
    <div
      className={`flex gap-3 max-w-3xl mx-auto ${isTarini ? "" : "flex-row-reverse"}`}
    >
      {/* Avatar */}
      {isTarini ? (
        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5">
          T
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full bg-bg-subtle flex items-center justify-center text-content-secondary text-xs flex-shrink-0 mt-0.5">
          You
        </div>
      )}

      {/* Message content */}
      {isTarini ? (
        <div className="max-w-[85%] space-y-0">
          {!hasContent ? (
            // Typing dots only while actively streaming — a finished empty bubble is invisible.
            // (The finally-block filter in useTarinaChat removes these from state, so this
            // branch should only ever render transiently while content is still arriving.)
            message.streaming ? (
              <div className="rounded-2xl rounded-tl-sm bg-bg-surface px-4 py-3">
                <span className="inline-flex gap-1 items-center py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-content-tertiary animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-content-tertiary animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-content-tertiary animate-bounce [animation-delay:300ms]" />
                </span>
              </div>
            ) : null
          ) : (
            <div className="space-y-0.5">
              {toolParts.length > 0 && (
                <ThinkingActivityBlock parts={toolParts} isStreaming={!!message.streaming} />
              )}
              {contentParts.map((part, i) => {
                // One-question guard: skip all but the last component per turn
                if (part.type === "component" && i !== lastComponentIdx) return null;
                if (part.type === "text") {
                  if (!part.text) return null;
                  return (
                    <div
                      key={i}
                      className="rounded-2xl rounded-tl-sm bg-bg-surface px-4 py-3 text-sm leading-relaxed text-content"
                    >
                      <MessagePartRenderer part={part} sendMessage={sendMessage} />
                      {message.streaming && i === contentParts.length - 1 && (
                        <span className="inline-block w-0.5 h-3.5 bg-accent-light ml-0.5 animate-pulse" />
                      )}
                    </div>
                  );
                }
                return (
                  <div key={i} className="max-w-full">
                    <MessagePartRenderer part={part} sendMessage={sendMessage} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* User message — subtle burgundy tint bubble */
        <div className="rounded-2xl rounded-tr-sm bg-accent/10 border border-accent/20 px-4 py-3 text-sm leading-relaxed text-content max-w-[85%]">
          <span className="whitespace-pre-wrap">
            {message.parts
              .filter((p) => p.type === "text")
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("")}
          </span>
        </div>
      )}
    </div>
  );
}
