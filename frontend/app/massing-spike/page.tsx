"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import {
  MassingModel,
  type MassingBlock,
  type MassingState,
} from "../components/blueprint/MassingModel";

const STATES: MassingState[] = ["idle", "generating", "updating", "settled", "error"];

/**
 * Dev-only harness — drive every massing state, the floor count, and per-floor
 * deltas live. Not part of the shipped product (404s in production).
 */
export default function MassingSpikePage() {
  if (process.env.NODE_ENV === "production") notFound();

  const [floors, setFloors] = useState(8);
  const [state, setState] = useState<MassingState>("settled");

  const blocks: MassingBlock[] = [{ label: "Block A", floors, accentTop: true }];
  const rooms = floors * 14;
  const stats = [
    { label: "Floors", value: floors },
    { label: "Rooms", value: `~${rooms}` },
    { label: "Types", value: 4 },
  ];

  return (
    <div className="min-h-screen bg-bg-deep text-content p-6 flex flex-col items-center gap-7">
      <header className="text-center max-w-xl">
        <p className="text-xs font-mono text-content-tertiary uppercase tracking-widest">
          Spike · Massing state machine
        </p>
        <h1 className="text-xl font-semibold mt-2">
          idle → generating → updating → settled → error
        </h1>
        <p className="text-sm text-content-secondary mt-1">
          Each state owns its motion. Generating draws once; updating keeps the
          building and signals work; settled is static; error is calm + tappable.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 justify-center">
        {STATES.map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            className={`px-3 py-1.5 rounded-lg border text-sm font-mono transition-colors cursor-pointer ${
              state === s
                ? "bg-accent text-white border-accent"
                : "bg-bg-elevated border-border hover:border-border-strong text-content-secondary"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-center text-sm bg-bg-surface border border-border rounded-2xl p-4 max-w-lg">
        <label className="flex items-center gap-2">
          Floors
          <input
            type="range" min={1} max={24} value={floors}
            onChange={(e) => setFloors(Number(e.target.value))}
            className="w-36"
          />
          <span className="font-mono w-6 text-right">{floors}</span>
        </label>
        <button
          onClick={() => { setState("settled"); requestAnimationFrame(() => setState("generating")); }}
          className="px-3 py-1.5 rounded-lg bg-bg-elevated border border-border hover:border-border-strong transition-colors cursor-pointer"
        >
          Replay generating
        </button>
        <button
          onClick={() => { setState("updating"); setFloors((f) => Math.min(24, f + 1)); }}
          className="px-3 py-1.5 rounded-lg bg-bg-elevated border border-border hover:border-border-strong transition-colors cursor-pointer"
        >
          + floor (delta)
        </button>
        <button
          onClick={() => { setState("updating"); setFloors((f) => Math.max(1, f - 1)); }}
          className="px-3 py-1.5 rounded-lg bg-bg-elevated border border-border hover:border-border-strong transition-colors cursor-pointer"
        >
          − floor (delta)
        </button>
      </div>

      <div className="w-[390px] max-w-full bg-bg-surface border border-border rounded-3xl p-4">
        <MassingModel
          state={state}
          blocks={blocks}
          propertyName="Sunrise Residency"
          meta={`HSR LAYOUT · ${floors} FLOORS`}
          stats={stats}
          onSendMessage={(t) => alert(`would send: ${t}`)}
        />
      </div>

      <p className="text-xs font-mono text-content-tertiary">
        current: <span className="text-accent-lighter">{state}</span> · {floors}F
      </p>
    </div>
  );
}
