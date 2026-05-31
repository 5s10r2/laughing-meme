import { describe, it, expect } from "vitest";
import { parseSSEStream } from "../sse-parser";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeResponse(lines: string[]): Response {
  const body = lines.join("\n") + "\n";
  return new Response(body);
}

function makeSignal(): AbortSignal {
  return new AbortController().signal;
}

async function collect(response: Response, signal = makeSignal()) {
  const events = [];
  for await (const event of parseSSEStream(response, signal)) {
    events.push(event);
  }
  return events;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("parseSSEStream", () => {
  it("parses a text event", async () => {
    const res = makeResponse(['data: {"type":"text","text":"Hello"}']);
    const events = await collect(res);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "text", text: "Hello" });
  });

  it("parses a done event", async () => {
    const res = makeResponse(['data: {"type":"done"}']);
    const events = await collect(res);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "done" });
  });

  it("parses a component event", async () => {
    const res = makeResponse([
      'data: {"type":"component","name":"MassingModel","props":{"blocks":[]},"id":"c1"}',
    ]);
    const events = await collect(res);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "component", name: "MassingModel" });
  });

  it("parses a state_snapshot event", async () => {
    const res = makeResponse([
      'data: {"type":"state_snapshot","state":{"property_name":"Sunrise"},"stage":"structure","stateVersion":2}',
    ]);
    const events = await collect(res);
    expect(events[0]).toMatchObject({
      type: "state_snapshot",
      stage: "structure",
      stateVersion: 2,
    });
  });

  it("parses an error event", async () => {
    const res = makeResponse([
      'data: {"type":"error","message":"Session expired","code":"session_not_found"}',
    ]);
    const events = await collect(res);
    expect(events[0]).toMatchObject({
      type: "error",
      code: "session_not_found",
    });
  });

  it("parses multiple events from a single stream", async () => {
    const res = makeResponse([
      'data: {"type":"text","text":"Hi"}',
      'data: {"type":"tool_start","tool":"apply_commands","description":"Saving…","id":"t1"}',
      'data: {"type":"done"}',
    ]);
    const events = await collect(res);
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.type)).toEqual(["text", "tool_start", "done"]);
  });

  it("silently skips malformed JSON", async () => {
    const res = makeResponse([
      "data: not-json",
      'data: {"type":"done"}',
    ]);
    const events = await collect(res);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("done");
  });

  it("silently skips events without a type field", async () => {
    const res = makeResponse([
      'data: {"foo":"bar"}',
      'data: {"type":"done"}',
    ]);
    const events = await collect(res);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("done");
  });

  it("skips lines that are not data: prefixed", async () => {
    const res = makeResponse([
      ": keep-alive",
      "",
      'data: {"type":"done"}',
    ]);
    const events = await collect(res);
    expect(events).toHaveLength(1);
  });

  it("skips [DONE] sentinel", async () => {
    const res = makeResponse(["data: [DONE]", 'data: {"type":"done"}']);
    const events = await collect(res);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("done");
  });

  it("returns nothing for an empty stream", async () => {
    const res = makeResponse([]);
    const events = await collect(res);
    expect(events).toHaveLength(0);
  });

  it("stops yielding when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const res = makeResponse(['data: {"type":"text","text":"Hi"}', 'data: {"type":"done"}']);
    const events = await collect(res, controller.signal);
    expect(events).toHaveLength(0);
  });

  it("returns nothing when response has no body", async () => {
    const res = { body: null } as unknown as Response;
    const events = await collect(res);
    expect(events).toHaveLength(0);
  });
});
