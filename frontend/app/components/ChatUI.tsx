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

// Mirrors the backend USE_NEW_EXPERIENCE flag. When on, the shell wears the warm
// Living Blueprint palette (.lp-theme re-scopes the design tokens); when off, the
// default dark theme is preserved byte-for-byte. Set both flags together.
const USE_NEW_EXPERIENCE = ["1", "true", "yes", "on"].includes(
  (process.env.NEXT_PUBLIC_USE_NEW_EXPERIENCE ?? "").trim().toLowerCase()
);

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
    sendMessage("", { initial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, quickReplies]);

  // ── Recover from a dead session ───────────────────────────────────────────

  /**
   * The stored session no longer exists on the backend (restarted / TTL-evicted).
   * Its data is gone anyway, so silently start a fresh session rather than dead-ending
   * on "Backend unavailable". The sessionId change re-triggers the opening greeting.
   */
  const recoverSession = useCallback(async () => {
    abortControllerRef.current?.abort();
    localStorage.removeItem("tarini_session_id");
    setQuickReplies(null);
    setMessages([]);
    setSessionId(null);
    try {
      const sid = await createSession();
      localStorage.setItem("tarini_session_id", sid);
      setSessionId(sid);
    } catch {
      setMessages([
        {
          id: uid(),
          role: "tarini",
          parts: [{ type: "text", text: "I couldn't reconnect. Please refresh to try again." }],
        },
      ]);
    }
  }, []);

  // ── Process SSE events into message parts ─────────────────────────────────

  /**
   * Core event handler: accumulates SSE events into the streaming message's
   * `parts` array. Text events coalesce into the last text part. Non-text
   * events create new parts.
   */
  const processEvent = useCallback(
    (event: SSEEvent, streamId: string) => {
      // Helper: apply fn only to the streaming message with the given id.
      const updateStream = (fn: (m: Message) => Message) =>
        setMessages((prev) => prev.map((m) => (m.id === streamId ? fn(m) : m)));

      switch (event.type) {
        case "text":
          updateStream((m) => {
            const parts = [...m.parts];
            const last = parts[parts.length - 1];
            // Coalesce consecutive text chunks into one text part
            if (last && last.type === "text") {
              parts[parts.length - 1] = { ...last, text: (last.text || "") + event.text };
            } else {
              parts.push({ type: "text", text: event.text });
            }
            return { ...m, parts };
          });
          break;

        case "component":
          updateStream((m) => ({
            ...m,
            parts: [...m.parts, { type: "component", componentName: event.name, props: event.props, componentId: event.id } satisfies MessagePart],
          }));
          break;

        case "tool_start":
          updateStream((m) => ({
            ...m,
            parts: [...m.parts, { type: "tool_activity", tool: event.tool, toolStatus: "running", toolDescription: event.description, toolId: event.id } satisfies MessagePart],
          }));
          break;

        case "tool_complete":
          updateStream((m) => ({
            ...m,
            parts: m.parts.map((p) =>
              p.type === "tool_activity" && p.toolId === event.id
                ? { ...p, toolStatus: "complete" as const, toolResult: event.result }
                : p
            ),
          }));
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
          // Dead session → silently recreate it instead of showing an error.
          if (event.code === "session_not_found") {
            recoverSession();
            break;
          }
          updateStream((m) => ({
            ...m,
            parts: [...m.parts, { type: "text", text: event.message || "Something went wrong." } satisfies MessagePart],
            streaming: false,
          }));
          break;

        case "done":
          // Stream end — handled by finally block in sendMessage
          break;
      }
    },
    [updateFromSnapshot, updateStage, recoverSession]
  );

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async function sendMessage(text: string, options?: { initial?: boolean }) {
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
        body: JSON.stringify({
          session_id: sessionId,
          message: text,
          initial: options?.initial === true,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error("Chat request failed");
      }

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
  }, [sessionId, isStreaming, processEvent]);

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
    <div className={`flex flex-col h-screen bg-bg-deep text-content${USE_NEW_EXPERIENCE ? " lp-theme" : ""}`}>
      {/* Header — legacy stage rail hidden in the new experience */}
      <ChatHeader onNewSession={handleNewSession} isStreaming={isStreaming} showStageProgress={!USE_NEW_EXPERIENCE} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-content-tertiary text-sm">Connecting to Tarini…</p>
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
