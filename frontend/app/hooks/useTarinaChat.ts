"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Message, MessagePart, SSEEvent, QuickReplyOption, Stage } from "../lib/types";
import { parseSSEStream } from "../lib/sse-parser";
import { useOnboardingState } from "../context/OnboardingStateContext";

// ── Session helpers ────────────────────────────────────────────────────────

function uid() {
  return crypto.randomUUID();
}

async function createSession(): Promise<string> {
  const res = await fetch("/api/session", { method: "POST" });
  if (!res.ok) throw new Error("Failed to create session");
  const { session_id } = await res.json();
  return session_id;
}

// ── Return type ────────────────────────────────────────────────────────────

export interface UseTarinaChatReturn {
  sessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  activity: string | null;
  quickReplies: QuickReplyOption[] | null;
  /** Bumped on every state_snapshot — lets an open Blueprint panel refetch. */
  modelRev: number;
  sendMessage: (text: string, options?: { initial?: boolean }) => Promise<void>;
  handleNewSession: () => void;
  handleBlueprintEdit: (summary: string) => void;
  /** Abort the current in-flight stream (wired to the ChatInput stop button). */
  abortStream: () => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * Owns all chat business logic: session lifecycle, SSE streaming, event
 * processing, and message assembly. ChatUI is left with only UI-local state
 * (input field value, panel open/close, toast) and the render tree.
 */
export function useTarinaChat(): UseTarinaChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReplyOption[] | null>(null);
  const [modelRev, setModelRev] = useState(0);
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

  // ── Recover from a dead session ───────────────────────────────────────────

  /**
   * The stored session no longer exists on the backend (restarted / TTL-evicted).
   * Its data is gone anyway, so silently start a fresh session rather than
   * dead-ending on "Backend unavailable". The sessionId change re-triggers the
   * opening greeting.
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
      const updateStream = (fn: (m: Message) => Message) =>
        setMessages((prev) => prev.map((m) => (m.id === streamId ? fn(m) : m)));

      switch (event.type) {
        case "text":
          updateStream((m) => {
            const parts = [...m.parts];
            const last = parts[parts.length - 1];
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
          setActivity(event.description || "Working…");
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
          setModelRev((r) => r + 1);
          break;

        case "quick_replies":
          setQuickReplies(event.options);
          break;

        case "thinking":
          break;

        case "error":
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
    setActivity("Thinking…");
    setQuickReplies(null);

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
                    { type: "text" as const, text: "Sorry, something went wrong. Please try again." },
                  ],
                  streaming: false,
                }
              : m
          )
        );
      }
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.id === streamId ? { ...m, streaming: false } : m))
      );
      setIsStreaming(false);
      setActivity(null);
    }
  }, [sessionId, isStreaming, processEvent]);

  // ── Trigger opening greeting ──────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId) return;
    sendMessage("", { initial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── New session ───────────────────────────────────────────────────────────

  const handleNewSession = useCallback(() => {
    abortControllerRef.current?.abort();
    localStorage.removeItem("tarini_session_id");
    setMessages([]);
    setSessionId(null);
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
  }, []);

  // ── Blueprint edit handler ────────────────────────────────────────────────

  const handleBlueprintEdit = useCallback((summary: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `evt_${Date.now()}_${Math.round(prev.length)}`, role: "event", parts: [{ type: "text", text: summary }] },
    ]);
  }, []);

  return {
    sessionId,
    messages,
    isStreaming,
    activity,
    quickReplies,
    modelRev,
    sendMessage,
    handleNewSession,
    handleBlueprintEdit,
    abortStream: () => abortControllerRef.current?.abort(),
  };
}
