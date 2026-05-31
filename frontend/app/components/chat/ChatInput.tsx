"use client";

import { useEffect, useRef } from "react";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (text: string) => void;
  isStreaming: boolean;
  disabled: boolean;
  /** live status verb while the agent works (drives the shimmer word) */
  activity?: string | null;
  /** abort the current stream */
  onStop?: () => void;
}

export function ChatInput({
  input,
  setInput,
  onSubmit,
  isStreaming,
  disabled,
  activity,
  onStop,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming || disabled) return;
    setInput("");
    onSubmit(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = input.trim();
      if (!text || isStreaming || disabled) return;
      setInput("");
      onSubmit(text);
    }
  }

  // Focus on mount and after stream completes
  useEffect(() => {
    if (!isStreaming) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isStreaming]);

  return (
    <form onSubmit={handleSubmit} className="border-t border-border px-4 py-4">
      <div className="max-w-3xl mx-auto">
        {isStreaming ? (
          // Working: the thinking composer — aura ring + breathing seal + live verb + stop.
          <div className="lp-compose is-working">
            <div className="lp-ring" />
            <div className="relative z-[1] flex items-center gap-3 rounded-xl border border-border-strong bg-bg-elevated px-3 py-3">
              <span className="lp-seal-breath flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent">
                <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M3 14.5 L3 6 L9 2.5 L15 6 L15 14.5" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              </span>
              <span className="lp-statusword flex h-[22px] flex-1 items-center" aria-live="polite">
                <span className="lp-gw whitespace-nowrap text-sm font-semibold">{activity || "Thinking…"}</span>
              </span>
              {onStop && (
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Stop"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-subtle transition-transform active:scale-90"
                >
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-accent" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder="Type your message…"
              rows={1}
              className="flex-1 resize-none bg-bg-elevated border border-border-strong rounded-xl px-4 py-3 text-sm text-content placeholder-content-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors disabled:opacity-40 overflow-y-hidden"
            />
            <button
              type="submit"
              disabled={!input.trim() || disabled}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-accent hover:bg-accent-light disabled:bg-bg-subtle disabled:opacity-50 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4 text-white"
              >
                <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
              </svg>
            </button>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-content-tertiary mt-2 hidden sm:block">
        Shift+Enter for new line · Enter to send
      </p>
    </form>
  );
}
