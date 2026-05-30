"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * MassingModel — the Living Blueprint signature.
 *
 * A generative isometric building drawn from a floor count. Pure data → SVG
 * polygons (no canvas, no three.js — flat iso never needs a camera).
 *
 * Motion is governed by an explicit state machine (idle/generating/updating/
 * settled/error); each state owns its motion. Per-floor motion is framer-motion
 * springs inside <AnimatePresence>: floors carry STABLE ground-relative ids, so
 * adding a floor mounts only the new one (it rises/fades in) while every other
 * floor SPRINGS to its new stack position. Springs preserve velocity, so an
 * edit arriving mid-animation retargets smoothly. Exit-animation on floor
 * removal holds within a stable build; entering `generating` remounts the set
 * to replay the full staggered entrance.
 *
 * Props arrive loosely-typed from an LLM via emit_ui, so `blocks` is coerced
 * defensively (finite, clamped floor counts) before any geometry runs.
 *
 * Renderer is procedural SVG by deliberate decision (see LIVING_BLUEPRINT.md).
 */

export interface MassingBlock {
  label: string;
  floors: number;
  accentTop?: boolean;
}

export type MassingState = "idle" | "generating" | "updating" | "settled" | "error";

interface MassingModelProps {
  blocks?: unknown;
  propertyName?: string;
  meta?: string;
  stats?: { label: string; value: number | string }[];
  state?: MassingState;
  onSendMessage?: (text: string) => void;
}

type Pt = [number, number];
const pt = (p: Pt) => `${p[0]},${p[1]}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Geometry constants
const HW = 62; // half-width of the iso diamond
const HH = 30; // half-height of the iso diamond
const MAX_TH = 17; // fattest a floor gets (few floors)
const LEGIBILITY_TH = 10; // thinnest before the canvas grows instead
const MIN_TH = 6; // hard floor when even a grown canvas must be capped
const TICK_MIN_TH = 13; // per-floor window ticks only when floors are this thick
const BASE_Y = 30;
const STACK_BUDGET = 136; // baseline stack height (8 × 17)
const BOTTOM_PAD = 50; // room for contact shadow + label
const MAX_VIEWH = 560; // cap so a tall building never makes an absurd bubble
const MAX_FLOORS = 40; // sane upper bound for a PG/hostel block

/** Coerce loosely-typed LLM `blocks` into validated MassingBlock[]. */
function coerceBlocks(raw: unknown): MassingBlock[] {
  const arr = Array.isArray(raw) ? raw : [];
  const blocks = arr.map((b, i): MassingBlock => {
    const fallbackLabel = `Block ${String.fromCharCode(65 + i)}`;
    if (b && typeof b === "object") {
      const o = b as Record<string, unknown>;
      const rawFloors = Number(o.floors ?? o.floor_count ?? o.count);
      const floors = Number.isFinite(rawFloors)
        ? clamp(Math.round(rawFloors), 1, MAX_FLOORS)
        : 1;
      const label =
        typeof o.label === "string" && o.label.trim()
          ? o.label
          : typeof o.name === "string" && o.name.trim()
            ? (o.name as string)
            : fallbackLabel;
      const accentTop = typeof o.accentTop === "boolean" ? o.accentTop : i === 0;
      return { label, floors, accentTop };
    }
    return { label: fallbackLabel, floors: 1, accentTop: i === 0 };
  });
  return blocks.length ? blocks : [{ label: "Block A", floors: 1, accentTop: true }];
}

interface FloorDescriptor {
  id: number; // stable, ground-relative (ground = 0)
  top: number; // vertical offset of this floor's top
  isTop: boolean;
  accent: boolean;
}

/** One floor's faces, drawn around LOCAL origin (x=0, top=0). */
function FloorFaces({
  th,
  accent,
  isTop,
  accentTop,
  showTicks,
}: {
  th: number;
  accent: boolean;
  isTop: boolean;
  accentTop: boolean;
  showTicks: boolean;
}) {
  const topPt: Pt = [0, 0];
  const right: Pt = [HW, HH];
  const front: Pt = [0, 2 * HH];
  const left: Pt = [-HW, HH];
  const frontB: Pt = [0, 2 * HH + th];
  const rightB: Pt = [HW, HH + th];
  const leftB: Pt = [-HW, HH + th];
  return (
    <>
      <polygon
        points={`${pt(left)} ${pt(front)} ${pt(frontB)} ${pt(leftB)}`}
        fill={accent ? "#8E88E4" : "url(#lpLft)"}
        stroke={accent ? "#5650D8" : "#9C8E73"}
        strokeWidth={accent ? 1.1 : 1}
        strokeLinejoin="round"
      />
      <polygon
        points={`${pt(front)} ${pt(right)} ${pt(rightB)} ${pt(frontB)}`}
        fill={accent ? "#7B75DE" : "url(#lpRgt)"}
        stroke={accent ? "#5650D8" : "#9C8E73"}
        strokeWidth={accent ? 1.1 : 1}
        strokeLinejoin="round"
      />
      {isTop && (
        <polygon
          points={`${pt(topPt)} ${pt(right)} ${pt(front)} ${pt(left)}`}
          fill={accentTop ? "url(#lpTopA)" : "url(#lpTop)"}
          stroke={accentTop ? "#5650D8" : "#9C8E73"}
          strokeWidth={1}
          strokeLinejoin="round"
        />
      )}
      {showTicks && (
        <g stroke={accent ? "#bdb8f2" : "#8a7c61"} strokeWidth={0.7} opacity={0.5}>
          {[0, 1, 2].map((w) => {
            const fx = 22 + w * 16;
            const fy = HH + 4 + w * 3.2;
            return <line key={w} x1={fx} y1={fy} x2={fx} y2={fy + th - 2} />;
          })}
        </g>
      )}
    </>
  );
}

const LIVE_LABEL: Record<MassingState, string> = {
  idle: "READY",
  generating: "BUILDING",
  updating: "UPDATING",
  settled: "READY",
  error: "RETRY",
};

export function MassingModel({
  blocks: rawBlocks,
  propertyName = "Your property",
  meta,
  stats,
  state = "settled",
  onSendMessage,
}: MassingModelProps) {
  const reduce = useReducedMotion();

  const blocks = useMemo(() => coerceBlocks(rawBlocks), [rawBlocks]);
  const primary = blocks[0];
  const floors = primary.floors;
  const accentTop = primary.accentTop ?? true;
  const cx = 160;

  // Replaying the full staggered entrance is desired only when (re)entering
  // `generating`; bumping genEpoch remounts the floors so the entrance plays.
  // During `updating` the epoch is stable so floors persist and only deltas move.
  const [genEpoch, setGenEpoch] = useState(0);
  const prevState = useRef<MassingState>(state);
  useEffect(() => {
    if (state === "generating" && prevState.current !== "generating") {
      setGenEpoch((e) => e + 1);
    }
    prevState.current = state;
  }, [state]);

  const isWorking = state === "generating" || state === "updating";
  const isError = state === "error";
  const staggering = state === "generating" && !reduce;

  // Geometry: portrait scaling — clamp thickness to a legibility floor, grow the
  // canvas to fit, and cap total height so a tall building never overflows.
  const { th, showTicks, viewH, descriptors, shadowCy, glowCy } = useMemo(() => {
    let thickness = clamp(STACK_BUDGET / floors, LEGIBILITY_TH, MAX_TH);
    let height = BASE_Y + (floors - 1) * thickness + 2 * HH + thickness + BOTTOM_PAD;
    if (height > MAX_VIEWH) {
      thickness = Math.max(MIN_TH, (MAX_VIEWH - BASE_Y - 2 * HH - BOTTOM_PAD) / floors);
      height = BASE_Y + (floors - 1) * thickness + 2 * HH + thickness + BOTTOM_PAD;
    }
    const ticks = thickness >= TICK_MIN_TH;
    const desc: FloorDescriptor[] = [];
    for (let k = floors - 1; k >= 0; k--) {
      desc.push({
        id: floors - 1 - k, // ground-relative, stable across edits
        top: BASE_Y + k * thickness,
        isTop: k === 0,
        accent: k === 0 && accentTop,
      });
    }
    const stackBottomY = BASE_Y + (floors - 1) * thickness + 2 * HH + thickness;
    return {
      th: thickness,
      showTicks: ticks,
      viewH: Math.round(height),
      descriptors: desc,
      shadowCy: Math.min(height - 14, stackBottomY + 6),
      glowCy: BASE_Y + ((floors - 1) * thickness) / 2 + HH,
    };
  }, [floors, accentTop]);

  // Stagger spans a fixed window regardless of floor count, so the top floors of
  // a tall building still enter in sequence (no flat simultaneous batch).
  const staggerStep = floors > 1 ? Math.min(0.04, 0.45 / (floors - 1)) : 0;

  const derivedStats = useMemo(
    () =>
      stats ?? [
        { label: "Blocks", value: blocks.length },
        { label: "Floors", value: blocks.reduce((s, b) => s + b.floors, 0) },
      ],
    [stats, blocks]
  );

  const springY = reduce
    ? ({ duration: 0 } as const)
    : ({ type: "spring", duration: 0.45, bounce: 0.12 } as const);

  return (
    <div
      className="lp-studio my-2"
      data-state={state}
      data-working={isWorking ? "true" : "false"}
    >
      <div className="lp-grid" />
      <div className="lp-sheen" />

      <div className="lp-shead">
        <div>
          <div className="lp-ti">{propertyName}</div>
          {meta && <div className="lp-meta">{meta}</div>}
        </div>
        {isError ? (
          <button
            type="button"
            className="lp-live is-error"
            onClick={() => onSendMessage?.("Try drawing my property again")}
          >
            <i />
            {LIVE_LABEL.error}
          </button>
        ) : (
          <div className="lp-live">
            <i />
            {LIVE_LABEL[state]}
          </div>
        )}
      </div>

      {state === "idle" ? (
        <div className="lp-idle">Tell me about your property and I&apos;ll draw it as we go.</div>
      ) : (
        <>
          <svg
            className="lp-massing"
            viewBox={`0 0 320 ${viewH}`}
            fill="none"
            role="img"
            aria-label={`Isometric model of ${propertyName}: ${primary.label}, ${floors} floor${floors !== 1 ? "s" : ""}`}
          >
            <defs>
              <linearGradient id="lpTop" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#F0EADD" />
                <stop offset="1" stopColor="#E2D9C7" />
              </linearGradient>
              <linearGradient id="lpLft" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#D8CDB6" />
                <stop offset="1" stopColor="#CABEA3" />
              </linearGradient>
              <linearGradient id="lpRgt" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#BCAE92" />
                <stop offset="1" stopColor="#A89A7C" />
              </linearGradient>
              <linearGradient id="lpTopA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#C9C5F2" />
                <stop offset="1" stopColor="#A9A3E8" />
              </linearGradient>
              <radialGradient id="lpGl" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="#6E68E8" stopOpacity="0.5" />
                <stop offset="1" stopColor="#6E68E8" stopOpacity="0" />
              </radialGradient>
              <filter id="lpSoft" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>

            <ellipse className="lp-glow" cx={cx} cy={glowCy} rx="95" ry="70" fill="url(#lpGl)" />
            <ellipse cx={cx} cy={shadowCy} rx="74" ry="17" fill="#000" opacity="0.3" filter="url(#lpSoft)" />

            {/* cx is constant for a single block: translate once, animate only y + opacity */}
            <g transform={`translate(${cx} 0)`}>
              <AnimatePresence mode="popLayout">
                {descriptors.map((f) => (
                  <motion.g
                    key={`${genEpoch}-${f.id}`}
                    data-fid={f.id}
                    initial={reduce ? false : { opacity: 0, y: f.top + 10 }}
                    animate={{ opacity: 1, y: f.top }}
                    exit={{ opacity: 0, transition: { duration: 0.18 } }}
                    transition={{
                      y: springY,
                      opacity: {
                        duration: reduce ? 0 : 0.3,
                        delay: staggering ? f.id * staggerStep : 0,
                      },
                    }}
                  >
                    <FloorFaces
                      th={th}
                      accent={f.accent}
                      isTop={f.isTop}
                      accentTop={accentTop}
                      showTicks={showTicks}
                    />
                  </motion.g>
                ))}
              </AnimatePresence>
            </g>

            <text
              x={cx}
              y={Math.round(shadowCy + 16)}
              fontFamily="ui-monospace, monospace"
              fontSize="9"
              fill="#9C97C4"
              textAnchor="middle"
            >
              {primary.label.toUpperCase()} · {floors}F
            </text>
          </svg>

          <div className="lp-foot">
            {derivedStats.map((s) => (
              <div className="lp-kv" key={s.label}>
                <b>{s.value}</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
