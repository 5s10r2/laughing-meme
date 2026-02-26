import type { SSEEvent } from "./types";

/**
 * Parse SSE stream from the backend into typed events.
 *
 * Handles all event types: text, component, tool_start, tool_complete,
 * state_snapshot, quick_replies, done, error, thinking.
 *
 * Yields parsed SSEEvent objects. Unrecognized events are silently skipped.
 */
export async function* parseSSEStream(
  response: Response,
  signal: AbortSignal
): AsyncGenerator<SSEEvent> {
  if (!response.body) return;

  const reader = response.body.getReader();
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
          const event = JSON.parse(raw) as SSEEvent;

          // Validate that we have a type field
          if (!event || typeof event !== "object" || !("type" in event)) continue;

          yield event;
        } catch {
          // malformed SSE line — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
