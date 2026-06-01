"use client";

import { useEffect, useRef, useState } from "react";
import type { QuickReplyOption } from "../lib/types";
import { useTarinaChat } from "../hooks/useTarinaChat";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatInput } from "./chat/ChatInput";
import { MessageBubble } from "./chat/MessageBubble";
import { QuickReplyChips } from "./ui/QuickReplyChips";
import { BlueprintPanel } from "./blueprint/BlueprintPanel";

// Build-time constant — evaluated once at module load from the NEXT_PUBLIC_ env var
// baked into the bundle at build time. Not reactive: changing it at runtime has no
// effect. Mirrors the backend USE_NEW_EXPERIENCE flag; set both together.
// When on: shell wears the warm Living Blueprint palette (.lp-theme token scope).
// When off: default dark theme is preserved byte-for-byte.
const USE_NEW_EXPERIENCE = ["1", "true", "yes", "on"].includes(
  (process.env.NEXT_PUBLIC_USE_NEW_EXPERIENCE ?? "").trim().toLowerCase()
);

export default function ChatUI() {
  // UI-local state — not part of chat business logic
  const [input, setInput] = useState("");
  const [blueprintOpen, setBlueprintOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const {
    sessionId,
    messages,
    isStreaming,
    activity,
    quickReplies,
    modelRev,
    sendMessage,
    handleNewSession,
    handleBlueprintEdit: notifyBlueprintEdit,
    abortStream,
  } = useTarinaChat();

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, quickReplies]);

  // ── Toast auto-dismiss ────────────────────────────────────────────────────

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function onNewSession() {
    setInput("");
    handleNewSession();
  }

  function handleQuickReply(value: string) {
    sendMessage(value);
  }

  function handleBlueprintEdit(summary: string) {
    if (!isStreaming) {
      // Close the panel and let Tarini acknowledge the edit in her own voice.
      // sendMessage adds a user bubble with the summary and triggers a real AI reply —
      // the model sees the current (already-updated) state and responds contextually.
      setBlueprintOpen(false);
      sendMessage(summary);
    } else {
      // A stream is already in flight — we can't send another message yet.
      // Fall back to the silent event line + toast so the edit isn't lost.
      notifyBlueprintEdit(summary);
      setToast(summary);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={`flex flex-col h-screen bg-bg-deep text-content${USE_NEW_EXPERIENCE ? " lp-theme" : ""}`}>
      <ChatHeader
        onNewSession={onNewSession}
        isStreaming={isStreaming}
        showStageProgress={!USE_NEW_EXPERIENCE}
        onOpenBlueprint={USE_NEW_EXPERIENCE ? () => setBlueprintOpen(true) : undefined}
      />

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

        {quickReplies && !isStreaming && (
          <div className="max-w-3xl mx-auto pl-10">
            <QuickReplyChips
              options={quickReplies as QuickReplyOption[]}
              onSendMessage={handleQuickReply}
            />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <ChatInput
        input={input}
        setInput={setInput}
        onSubmit={sendMessage}
        isStreaming={isStreaming}
        disabled={!sessionId}
        activity={activity}
        onStop={abortStream}
      />

      <BlueprintPanel
        open={blueprintOpen}
        onClose={() => setBlueprintOpen(false)}
        sessionId={sessionId}
        sendMessage={sendMessage}
        refreshKey={modelRev}
        onEdit={handleBlueprintEdit}
      />

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4">
          <div
            role="status"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-content px-4 py-2 text-sm font-medium text-bg-deep shadow-lg"
          >
            <span aria-hidden="true">✓</span>
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
