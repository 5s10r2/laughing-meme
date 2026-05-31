import { describe, it, expect } from "vitest";
import { adaptComponentProps } from "../component-adapters";

// ── adaptComponentProps — MassingModel ─────────────────────────────────────

describe("adaptComponentProps — MassingModel", () => {
  it("maps blocks array through unchanged", () => {
    const blocks = [{ floors: 3, active: true }];
    const result = adaptComponentProps("MassingModel", { blocks });
    expect(result.blocks).toEqual(blocks);
  });

  it("defaults blocks to empty array when missing", () => {
    const result = adaptComponentProps("MassingModel", {});
    expect(result.blocks).toEqual([]);
  });

  it("accepts state string values", () => {
    const result = adaptComponentProps("MassingModel", { blocks: [], state: "generating" });
    expect(result.state).toBe("generating");
  });

  it("defaults state to idle when missing", () => {
    const result = adaptComponentProps("MassingModel", { blocks: [] });
    expect(result.state).toBe("idle");
  });
});

// ── adaptComponentProps — FloorLedger ─────────────────────────────────────

describe("adaptComponentProps — FloorLedger", () => {
  it("maps floors array", () => {
    const floors = [
      { index: 0, label: "Ground", active: true, units: [] },
    ];
    const result = adaptComponentProps("FloorLedger", { floors });
    expect(Array.isArray(result.floors)).toBe(true);
    expect((result.floors as unknown[]).length).toBe(1);
  });

  it("defaults floors to empty array when missing", () => {
    const result = adaptComponentProps("FloorLedger", {});
    expect(result.floors).toEqual([]);
  });
});

// ── adaptComponentProps — UnmappedWarning ─────────────────────────────────

describe("adaptComponentProps — UnmappedWarning", () => {
  it("passes count through", () => {
    const result = adaptComponentProps("UnmappedWarning", { count: 3, rooms: [] });
    expect(result.count).toBe(3);
  });

  it("defaults count to 0 when missing", () => {
    const result = adaptComponentProps("UnmappedWarning", {});
    expect(result.count).toBe(0);
  });
});

// ── adaptComponentProps — unknown component ───────────────────────────────

describe("adaptComponentProps — unknown component", () => {
  it("passes props through unchanged for unknown components", () => {
    const props = { foo: "bar", baz: 42 };
    const result = adaptComponentProps("SomeUnknownComponent", props);
    expect(result).toMatchObject(props);
  });
});

// ── adaptComponentProps — QuickReplyChips ────────────────────────────────

describe("adaptComponentProps — QuickReplyChips", () => {
  it("maps options array", () => {
    const options = [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ];
    const result = adaptComponentProps("QuickReplyChips", { options });
    expect(result.options).toEqual(options);
  });
});
