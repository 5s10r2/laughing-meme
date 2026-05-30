"use client";

import { FloorComposition, type CompositionSegment } from "../components/blueprint/FloorComposition";
import { FloorLedger, type LedgerFloor } from "../components/blueprint/FloorLedger";
import { TYPE_COLORS } from "../components/blueprint/tokens";
import { CARD } from "../components/ui/primitives";

/**
 * Living Blueprint storybook (warm-paper surface, scoped via .lp-theme).
 * The revamped showcase — built in isolation so we can validate the new
 * components without flipping the live dark chat shell yet. Grows as components
 * land. Seeded here with the FloorComposition keystone across the heterogeneity
 * cases it must handle.
 */

const typeSeg = (key: string, count: number): CompositionSegment => ({
  key,
  label: key,
  count,
  color: TYPE_COLORS[key] ?? "var(--t-single)",
});

// distinct package palette for the mapping re-skin demo
const PKG_COLORS = ["var(--t-single)", "var(--t-double)", "var(--t-deluxe)", "var(--t-triple)"];

// a realistic building for the ledger (top-down), incl. a mapped floor + an empty one
const LEDGER_FLOORS: LedgerFloor[] = [
  {
    id: 5, name: "Floor 5", sub: "top", rooms: 18, nameRange: "501–518",
    segments: [typeSeg("single", 10), typeSeg("double", 4), typeSeg("deluxe", 2), typeSeg("triple", 2)],
  },
  {
    id: 4, name: "Floor 4", rooms: 16, mapped: true, nameRange: "401–416",
    segments: [typeSeg("single", 12), typeSeg("double", 4)],
  },
  {
    id: 3, name: "Floor 3", rooms: 16, nameRange: "301–316",
    segments: [typeSeg("single", 11), typeSeg("triple", 5)],
  },
  { id: 2, name: "Floor 2", rooms: 0, segments: [] },
  {
    id: 1, name: "Ground", sub: "reception", rooms: 14, nameRange: "001–014",
    segments: [typeSeg("single", 10), typeSeg("double", 2), typeSeg("deluxe", 2)],
  },
];

function Specimen({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div className={CARD}>
      <p className="text-[11px] font-mono uppercase tracking-wider text-content-tertiary mb-3">
        {caption}
      </p>
      {children}
    </div>
  );
}

function FloorRow({
  name,
  sub,
  rooms,
  children,
}: {
  name: string;
  sub?: string;
  rooms: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-sm font-semibold text-content">
          {name}
          {sub && <span className="text-content-tertiary font-normal"> · {sub}</span>}
        </p>
        <span className="text-xs font-mono text-content-secondary">{rooms} rooms</span>
      </div>
      {children}
    </div>
  );
}

export default function BlueprintStorybookPage() {
  // dev-only surface — prod reachability is blocked in middleware.ts
  return (
    <div className="lp-theme min-h-screen px-6 py-10 flex flex-col items-center gap-7">
      <header className="text-center max-w-xl">
        <p className="text-[11px] font-mono uppercase tracking-widest text-accent">
          Living Blueprint · Storybook
        </p>
        <h1 className="text-2xl font-semibold text-content mt-2">
          FloorComposition — the keystone primitive
        </h1>
        <p className="text-sm text-content-secondary mt-2">
          One dimension-agnostic primitive: a proportional bar, legend, and capped
          room cells. It re-skins by stage (type-mix or package-mix) and carries
          almost all of the floor-level heterogeneity.
        </p>
      </header>

      <div className="w-full max-w-md flex flex-col gap-5">
        <Specimen caption="Homogeneous floor — bar + legend">
          <FloorRow name="Floor 1" rooms={14}>
            <FloorComposition segments={[typeSeg("single", 14)]} showLegend />
          </FloorRow>
        </Specimen>

        <Specimen caption="Different sharing types in one floor — bar + legend + cells">
          <FloorRow name="Floor 5" sub="top" rooms={18}>
            <FloorComposition
              segments={[
                typeSeg("single", 10),
                typeSeg("double", 4),
                typeSeg("deluxe", 2),
                typeSeg("triple", 2),
              ]}
              showLegend
              showCells
            />
          </FloorRow>
        </Specimen>

        <Specimen caption="Different packages in one floor — same primitive, re-skinned by package">
          <FloorRow name="Floor 2" rooms={12}>
            <FloorComposition
              segments={[
                { key: "ac-single", label: "AC Single", count: 6, color: PKG_COLORS[0] },
                { key: "nonac-double", label: "Non-AC Double", count: 4, color: PKG_COLORS[1] },
                { key: "deluxe", label: "Deluxe", count: 2, color: PKG_COLORS[2] },
              ]}
              showLegend
              showCells
            />
          </FloorRow>
        </Specimen>

        <Specimen caption="Dense floor (40 rooms) — cells cap at +N, bar stays legible">
          <FloorRow name="Floor 9" rooms={40}>
            <FloorComposition
              segments={[
                typeSeg("single", 24),
                typeSeg("double", 10),
                typeSeg("triple", 6),
              ]}
              showLegend
              showCells
            />
          </FloorRow>
        </Specimen>

        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-content-tertiary mb-3">
            Floor ledger (§4.2) — tap a row to expand; Floor 4 is mapped, Floor 2 is empty
          </p>
          <FloorLedger
            floors={LEDGER_FLOORS}
            activeId={5}
            onSendMessage={(t) => alert(`would send: ${t}`)}
          />
        </div>
      </div>
    </div>
  );
}
