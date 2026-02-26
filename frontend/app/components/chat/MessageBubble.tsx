"use client";

import type { Message } from "../../lib/types";
import { MessagePartRenderer } from "./MessagePartRenderer";

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
  const isTarini = message.role === "tarini";
  const hasContent = message.parts.length > 0 && message.parts.some(
    (p) => (p.type === "text" && p.text) || p.type === "component" || p.type === "tool_activity"
  );

  return (
    <div
      className={`flex gap-3 max-w-3xl mx-auto ${isTarini ? "" : "flex-row-reverse"}`}
    >
      {/* Avatar */}
      {isTarini ? (
        <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-zinc-950 font-bold text-xs flex-shrink-0 mt-0.5">
          T
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 text-xs flex-shrink-0 mt-0.5">
          You
        </div>
      )}

      {/* Message content */}
      {isTarini ? (
        <div className="max-w-[85%] space-y-0">
          {!hasContent ? (
            /* Typing indicator — no parts yet */
            <div className="rounded-2xl rounded-tl-sm bg-zinc-900 px-4 py-3">
              <span className="inline-flex gap-1 items-center py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          ) : (
            <div className="space-y-0.5">
              {message.parts.map((part, i) => {
                // Text parts get the bubble styling
                if (part.type === "text") {
                  if (!part.text) return null;
                  return (
                    <div
                      key={i}
                      className="rounded-2xl rounded-tl-sm bg-zinc-900 px-4 py-3 text-sm leading-relaxed text-zinc-100"
                    >
                      <MessagePartRenderer part={part} sendMessage={sendMessage} />
                      {/* Streaming cursor — only on last text part while streaming */}
                      {message.streaming && i === message.parts.length - 1 && (
                        <span className="inline-block w-0.5 h-3.5 bg-amber-400 ml-0.5 animate-pulse" />
                      )}
                    </div>
                  );
                }

                // Component and tool_activity parts render outside the text bubble
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
        /* User message — simple text bubble */
        <div className="rounded-2xl rounded-tr-sm bg-amber-500 px-4 py-3 text-sm leading-relaxed text-zinc-950 max-w-[85%]">
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
