"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * MassingModel — the Living Blueprint signature.
 *
 * A generative isometric building drawn from a floor count. Pure data → SVG
 * polygons (no canvas, no three.js — flat iso never needs a camera).
 *
 * Motion is governed by an explicit state machine (idle/generating/updating/
 * settled/error); see the state notes below. Per-floor motion is owned by
 * framer-motion: each floor is a keyed <motion.g> inside <AnimatePresence>.
 * Floors carry STABLE ground-relative ids, so adding a floor mounts only the
 * new one (it fades/rises in) while every existing floor SPRINGS to its new
 * stack position. Because springs preserve velocity, an edit that arrives
 * mid-animation retargets smoothly instead of restarting (Emil: "springs
 * maintain velocity when interrupted; CSS animations restart from zero").
 *
 * Renderer is procedural SVG by deliberate decision (see project memory).
 */

export interface MassingBlock {
  label: string;
  floors: number;
  accentTop?: boolean;
}

export type MassingState = "idle" | "generating" | "updating" | "settled" | "error";

type Variant = "literal" | "portrait";

interface MassingModelProps {
  blocks?: MassingBlock[];
  propertyName?: string;
  meta?: string;
  stats?: { label: string; value: number | string }[];
  variant?: Variant;
  state?: MassingState;
  onSendMessage?: (text: string) => void;
}

type Pt = [number, number];
const pt = (p: Pt) => `${p[0]},${p[1]}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Geometry constants
const HW = 62;
const HH = 30;
const MAX_TH = 17;
const LEGIBILITY_TH = 10;
const TICK_MIN_TH = 13;
const BASE_Y = 30;
const LITERAL_BUDGET = 136;
const BOTTOM_PAD = 50;

/** One floor's faces, drawn around LOCAL origin (x=0, top=0). The <motion.g>
 *  wrapper translates it to its stack position, so position is animatable
 *  independent of shape. */
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

const DEFAULT_BLOCKS: MassingBlock[] = [{ label: "Block A", floors: 8, accentTop: true }];

const LIVE_LABEL: Record<MassingState, string> = {
  idle: "READY",
  generating: "BUILDING",
  updating: "UPDATING",
  settled: "READY",
  error: "TAP TO RETRY",
};

export function MassingModel({
  blocks = DEFAULT_BLOCKS,
  propertyName = "Your property",
  meta,
  stats,
  variant = "portrait",
  state = "settled",
  onSendMessage,
}: MassingModelProps & Record<string, unknown>) {
  const reduce = useReducedMotion();

  // Replaying the full staggered entrance is desired only when (re)entering
  // `generating`. Bumping genEpoch remounts the floors so the entrance plays;
  // during `updating` the epoch is stable so floors persist and only deltas move.
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

  const primary = blocks[0] ?? { label: "Block", floors: 1, accentTop: true };
  const floors = primary.floors;
  const accentTop = primary.accentTop ?? true;
  const cx = 160;

  let th: number;
  let showTicks: boolean;
  let viewH: number;
  if (variant === "literal") {
    th = LITERAL_BUDGET / floors;
    showTicks = true;
    viewH = 320;
  } else {
    th = clamp(LITERAL_BUDGET / floors, LEGIBILITY_TH, MAX_TH);
    showTicks = th >= TICK_MIN_TH;
    viewH = Math.max(320, BASE_Y + (floors - 1) * th + 2 * HH + th + BOTTOM_PAD);
  }
  // Floor descriptors with STABLE ground-relative ids (ground = 0).
  // k is the on-screen index (0 = top). top = vertical offset for that floor.
  const descriptors = [];
  for (let k = floors - 1; k >= 0; k--) {
    const id = floors - 1 - k; // ground-relative, stable across edits
    const top = BASE_Y + k * th;
    const isTop = k === 0;
    descriptors.push({ id, top, isTop, accent: isTop && accentTop });
  }

  const stackBottomY = BASE_Y + (floors - 1) * th + 2 * HH + th;
  const shadowCy = Math.min(viewH - 14, stackBottomY + 6);
  const glowCy = BASE_Y + ((floors - 1) * th) / 2 + HH;

  const derivedStats =
    stats ??
    [
      { label: "Blocks", value: blocks.length },
      { label: "Floors", value: blocks.reduce((s, b) => s + b.floors, 0) },
    ];

  const springY = reduce
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.45, bounce: 0.12 };

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
        <div
          className={`lp-live${isError ? " is-error" : ""}`}
          role={isError ? "button" : undefined}
          tabIndex={isError ? 0 : undefined}
          onClick={isError ? () => onSendMessage?.("Try drawing my property again") : undefined}
        >
          <i />
          {LIVE_LABEL[state]}
        </div>
      </div>

      {state === "idle" ? (
        <div className="lp-idle">Tell me about your property and I&apos;ll draw it as we go.</div>
      ) : (
        <>
          <svg
            className="lp-massing"
            viewBox={`0 0 320 ${Math.round(viewH)}`}
            fill="none"
            role="img"
            aria-label={`Isometric model of ${propertyName}: ${primary.label} ${floors} floors`}
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

            {/* cx is constant for a single block, so translate once statically and
                let each floor animate only its vertical position + opacity. */}
            <g transform={`translate(${cx} 0)`}>
              <AnimatePresence>
                {descriptors.map((f) => (
                  <motion.g
                    key={`${genEpoch}-${f.id}`}
                    data-fid={f.id}
                    initial={reduce ? false : { opacity: 0, y: f.top + 10 }}
                    animate={{ opacity: 1, y: f.top }}
                    exit={{ opacity: 0, transition: { duration: 0.22 } }}
                    transition={{
                      y: springY,
                      opacity: {
                        duration: reduce ? 0 : 0.3,
                        delay: staggering ? Math.min(f.id * 0.035, 0.5) : 0,
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
