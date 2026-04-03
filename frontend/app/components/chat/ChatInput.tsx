"use client";

import { useEffect, useRef } from "react";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (text: string) => void;
  isStreaming: boolean;
  disabled: boolean;
}

export function ChatInput({
  input,
  setInput,
  onSubmit,
  isStreaming,
  disabled,
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
      <div className="flex items-end gap-3 max-w-3xl mx-auto">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming || disabled}
          placeholder={
            isStreaming ? "Tarini is responding…" : "Type your message…"
          }
          rows={1}
          className="flex-1 resize-none bg-bg-elevated border border-border-strong rounded-xl px-4 py-3 text-sm text-content placeholder-content-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors disabled:opacity-40 overflow-y-hidden"
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming || disabled}
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
      <p className="text-center text-xs text-content-tertiary mt-2 hidden sm:block">
        Shift+Enter for new line · Enter to send
      </p>
    </form>
  );
}
