"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Message, MessagePart, SSEEvent, QuickReplyOption, Stage } from "../lib/types";
import { parseSSEStream } from "../lib/sse-parser";
import { useOnboardingState } from "../context/OnboardingStateContext";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatInput } from "./chat/ChatInput";
import { MessageBubble } from "./chat/MessageBubble";
import { QuickReplyChips } from "./ui/QuickReplyChips";

// ── Helpers ────────────────────────────────────────────────────────────────

function uid() {
  return crypto.randomUUID();
}

async function createSession(): Promise<string> {
  const res = await fetch("/api/session", { method: "POST" });
  if (!res.ok) throw new Error("Failed to create session");
  const { session_id } = await res.json();
  return session_id;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReplyOption[] | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { updateFromSnapshot, updateStage } = useOnboardingState();

  // ── Session init ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      let sid = localStorage.getItem("tarini_session_id");

      if (!sid) {
        try {
          sid = await createSession();
          localStorage.setItem("tarini_session_id", sid);
        } catch {
          setMessages([
            {
              id: uid(),
              role: "tarini",
              parts: [
                {
                  type: "text",
                  text: "Sorry, I couldn't connect right now. Please check the backend is running and refresh.",
                },
              ],
            },
          ]);
          return;
        }
      }

      setSessionId(sid);
    }
    init();
  }, []);

  // ── Abort on unmount ──────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // ── Trigger opening greeting ──────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId) return;
    sendMessage("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, quickReplies]);

  // ── Process SSE events into message parts ─────────────────────────────────

  /**
   * Core event handler: accumulates SSE events into the streaming message's
   * `parts` array. Text events coalesce into the last text part. Non-text
   * events create new parts.
   */
  const processEvent = useCallback(
    (event: SSEEvent, streamId: string) => {
      switch (event.type) {
        case "text":
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== streamId) return m;
              const parts = [...m.parts];
              const last = parts[parts.length - 1];
              // Coalesce consecutive text chunks into one text part
              if (last && last.type === "text") {
                parts[parts.length - 1] = {
                  ...last,
                  text: (last.text || "") + event.text,
                };
              } else {
                parts.push({ type: "text", text: event.text });
              }
              return { ...m, parts };
            })
          );
          break;

        case "component":
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== streamId) return m;
              const part: MessagePart = {
                type: "component",
                componentName: event.name,
                props: event.props,
                componentId: event.id,
              };
              return { ...m, parts: [...m.parts, part] };
            })
          );
          break;

        case "tool_start":
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== streamId) return m;
              const part: MessagePart = {
                type: "tool_activity",
                tool: event.tool,
                toolStatus: "running",
                toolDescription: event.description,
                toolId: event.id,
              };
              return { ...m, parts: [...m.parts, part] };
            })
          );
          break;

        case "tool_complete":
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== streamId) return m;
              const parts = m.parts.map((p) => {
                if (
                  p.type === "tool_activity" &&
                  p.toolId === event.id
                ) {
                  return {
                    ...p,
                    toolStatus: "complete" as const,
                    toolResult: event.result,
                  };
                }
                return p;
              });
              return { ...m, parts };
            })
          );

          // If advance_stage completed, update stage in context
          if (event.tool === "advance_stage" && event.result?.stage) {
            updateStage(event.result.stage as Stage);
          }
          break;

        case "state_snapshot":
          updateFromSnapshot(event.state, event.stage, event.stateVersion);
          break;

        case "quick_replies":
          setQuickReplies(event.options);
          break;

        case "thinking":
          // keepalive — no action needed
          break;

        case "error":
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== streamId) return m;
              const part: MessagePart = {
                type: "text",
                text: event.message || "Something went wrong.",
              };
              return { ...m, parts: [...m.parts, part], streaming: false };
            })
          );
          break;

        case "done":
          // Stream end — handled by finally block in sendMessage
          break;
      }
    },
    [updateFromSnapshot, updateStage]
  );

  // ── Send message ──────────────────────────────────────────────────────────

  async function sendMessage(text: string) {
    if (!sessionId || isStreaming) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsStreaming(true);
    setQuickReplies(null); // Clear previous quick replies

    // Add user message (skip for the silent opening prompt)
    if (text.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "user",
          parts: [{ type: "text", text: text.trim() }],
        },
      ]);
    }

    // Add a streaming Tarini message (empty parts, shows typing indicator)
    const streamId = uid();
    setMessages((prev) => [
      ...prev,
      { id: streamId, role: "tarini", parts: [], streaming: true },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: text }),
        signal: controller.signal,
      });

      for await (const event of parseSSEStream(res, controller.signal)) {
        processEvent(event, streamId);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // intentional cancel — do nothing
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamId
              ? {
                  ...m,
                  parts: [
                    ...m.parts,
                    {
                      type: "text" as const,
                      text: "Sorry, something went wrong. Please try again.",
                    },
                  ],
                  streaming: false,
                }
              : m
          )
        );
      }
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamId ? { ...m, streaming: false } : m
        )
      );
      setIsStreaming(false);
    }
  }

  // ── New session ───────────────────────────────────────────────────────────

  function handleNewSession() {
    abortControllerRef.current?.abort();
    localStorage.removeItem("tarini_session_id");
    setMessages([]);
    setSessionId(null);
    setInput("");
    setQuickReplies(null);

    createSession()
      .then((sid) => {
        localStorage.setItem("tarini_session_id", sid);
        setSessionId(sid);
      })
      .catch(() => {
        setMessages([
          {
            id: uid(),
            role: "tarini",
            parts: [
              {
                type: "text",
                text: "Sorry, I couldn't start a new session. Please check your connection and try again.",
              },
            ],
          },
        ]);
      });
  }

  // ── Quick reply handler ───────────────────────────────────────────────────

  function handleQuickReply(value: string) {
    setQuickReplies(null);
    sendMessage(value);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header with stage progress bar */}
      <ChatHeader onNewSession={handleNewSession} isStreaming={isStreaming} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-600 text-sm">Connecting to Tarini…</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            sendMessage={sendMessage}
          />
        ))}

        {/* Quick reply chips — shown after the last message */}
        {quickReplies && !isStreaming && (
          <div className="max-w-3xl mx-auto pl-10">
            <QuickReplyChips
              options={quickReplies}
              onSendMessage={handleQuickReply}
            />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput
        input={input}
        setInput={setInput}
        onSubmit={sendMessage}
        isStreaming={isStreaming}
        disabled={!sessionId}
      />
    </div>
  );
}
