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
    <form onSubmit={handleSubmit} className="border-t border-zinc-800 px-4 py-4">
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
          className="flex-1 resize-none bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors disabled:opacity-40 overflow-y-hidden"
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming || disabled}
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
  );
}
