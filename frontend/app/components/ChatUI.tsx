"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "tarini";
  text: string;
  streaming?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Fix #12a: crypto.randomUUID() gives proper RFC-4122 UUIDs, not Math.random() collisions.
function uid() {
  return crypto.randomUUID();
}

async function createSession(): Promise<string> {
  const res = await fetch("/api/session", { method: "POST" });
  if (!res.ok) throw new Error("Failed to create session");
  const { session_id } = await res.json();
  return session_id;
}

// Fix #5: Accept AbortSignal so in-flight streams can be cancelled.
// Fix #5: Release the reader lock in finally so the stream is never stranded.
async function* streamChat(
  session_id: string,
  message: string,
  signal: AbortSignal
): AsyncGenerator<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id, message }),
    signal,
  });

  if (!res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;

        try {
          const event = JSON.parse(raw);
          if (event.type === "text" && event.text) {
            yield event.text;
          }
        } catch {
          // malformed SSE line — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Fix #5: One AbortController per in-flight send — aborted on unmount or new session.
  const abortControllerRef = useRef<AbortController | null>(null);

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
              text: "Sorry, I couldn't connect right now. Please check the backend is running and refresh.",
            },
          ]);
          return;
        }
      }

      setSessionId(sid);
    }
    init();
  }, []);

  // ── Abort in-flight stream on component unmount ───────────────────────────

  // Fix #5: Clean up the SSE reader when the component unmounts.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // ── Trigger opening greeting once session is ready ────────────────────────

  useEffect(() => {
    if (!sessionId) return;
    sendMessage(""); // empty string triggers the opening greeting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Textarea auto-resize ──────────────────────────────────────────────────

  // Fix #11: Cross-browser auto-grow textarea — replaces the Chrome-only
  // fieldSizing: "content" CSS property (only available in Chrome 123+).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // ── Send message ──────────────────────────────────────────────────────────

  async function sendMessage(text: string) {
    if (!sessionId || isStreaming) return;

    // Fix #5: Create a fresh AbortController per send so old ones don't linger.
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsStreaming(true);

    // Add user message (skip for the silent opening prompt)
    if (text.trim()) {
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "user", text: text.trim() },
      ]);
    }

    // Add a streaming Tarini message
    const streamId = uid();
    setMessages((prev) => [
      ...prev,
      { id: streamId, role: "tarini", text: "", streaming: true },
    ]);

    try {
      for await (const chunk of streamChat(sessionId, text, controller.signal)) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamId ? { ...m, text: m.text + chunk } : m
          )
        );
      }
    } catch (err) {
      // Fix #5: AbortError is intentional (unmount / new session) — swallow silently.
      if (err instanceof Error && err.name === "AbortError") {
        // intentional cancel — do nothing
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamId
              ? {
                  ...m,
                  text: "Sorry, something went wrong. Please try again.",
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
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage(text);
  }

  // Fix #12b: Inline the logic instead of casting the keyboard event to FormEvent.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = input.trim();
      if (!text || isStreaming) return;
      setInput("");
      sendMessage(text);
    }
  }

  // Fix #6: Abort any in-flight stream before resetting, and surface errors to the user.
  function handleNewSession() {
    abortControllerRef.current?.abort();
    localStorage.removeItem("tarini_session_id");
    setMessages([]);
    setSessionId(null);
    setInput("");
    // Re-init
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
            text: "Sorry, I couldn't start a new session. Please check your connection and try again.",
          },
        ]);
      });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-zinc-950 font-bold text-sm">
            T
          </div>
          <div>
            <h1 className="font-semibold text-zinc-100 leading-tight">Tarini</h1>
            <p className="text-xs text-zinc-500">RentOK Property Onboarding</p>
          </div>
        </div>
        <button
          onClick={handleNewSession}
          disabled={isStreaming}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
        >
          New session
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-600 text-sm">Connecting to Tarini…</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-zinc-800 px-4 py-4"
      >
        <div className="flex items-end gap-3 max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming || !sessionId}
            placeholder={isStreaming ? "Tarini is responding…" : "Type your message…"}
            rows={1}
            className="flex-1 resize-none bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors disabled:opacity-40 overflow-y-hidden"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming || !sessionId}
            className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:opacity-50 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-zinc-950"
            >
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-zinc-700 mt-2">
          Shift+Enter for new line · Enter to send
        </p>
      </form>
    </div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isTarini = message.role === "tarini";

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

      {/* Bubble */}
      <div
        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] ${
          isTarini
            ? "bg-zinc-900 text-zinc-100 rounded-tl-sm"
            : "bg-amber-500 text-zinc-950 rounded-tr-sm"
        }`}
      >
        {message.text ? (
          <span className="whitespace-pre-wrap">{message.text}</span>
        ) : (
          <span className="inline-flex gap-1 items-center py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:300ms]" />
          </span>
        )}
        {message.streaming && message.text && (
          <span className="inline-block w-0.5 h-3.5 bg-amber-400 ml-0.5 animate-pulse" />
        )}
      </div>
    </div>
  );
}
