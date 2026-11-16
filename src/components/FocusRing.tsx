import React from 'react';
import { FocusPhase, FocusPlan, FLOW_EXTENSION_MS } from '../domain/focus';
import { formatTimeDisplay } from '../utils/timeFormatters';
import { FOCUS_MODE_LABELS } from '../constants/defaultConfig';

interface FocusRingProps {
  plan: FocusPlan;
  /** `null` while nothing is running. */
  phase: FocusPhase | null;
  calm?: boolean;
}

const RADIUS = 118;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const FLOW_RADIUS = 130;
const FLOW_CIRCUMFERENCE = 2 * Math.PI * FLOW_RADIUS;

const clock = (ms: number): string => formatTimeDisplay(ms).mainTime;

interface Reading {
  /** 0 to 1, how far through the phase. */
  progress: number;
  /** 0 to 1, how far into the extra time of a block that overran its target. */
  overrun: number;
  label: string;
  time: string;
  sub: string;
  tone: 'focus' | 'break' | 'idle';
}

/** What the ring says, as plain data so the markup below has no decisions in it. */
function read(plan: FocusPlan, phase: FocusPhase | null): Reading {
  if (!phase) {
    return {
      progress: 0,
      overrun: 0,
      label: 'Erster Block',
      time: clock(plan.focusMs),
      sub: `${FOCUS_MODE_LABELS[plan.mode]} · ${plan.focusMs / 60_000} / ${plan.breakMs / 60_000}`,
      tone: 'idle',
    };
  }

  const { elapsedMs, targetMs } = phase;

  if (phase.kind === 'break') {
    const over = elapsedMs >= phase.targetMs;
    return {
      progress: Math.min(1, elapsedMs / phase.targetMs),
      overrun: 0,
      label: 'Pause',
      time: over ? `+${clock(elapsedMs - phase.targetMs)}` : clock(phase.targetMs - elapsedMs),
      sub: over ? 'Pause überzogen' : 'bis zum nächsten Block',
      tone: 'break',
    };
  }

  const label = `Fokus · Block ${phase.block}`;
  if (targetMs === null) {
    return {
      progress: 0,
      overrun: 0,
      label,
      time: clock(elapsedMs),
      sub: 'seit Blockbeginn',
      tone: 'focus',
    };
  }
  if (elapsedMs < targetMs) {
    return {
      progress: elapsedMs / targetMs,
      overrun: 0,
      label,
      time: clock(targetMs - elapsedMs),
      sub: 'bis zum Ziel',
      tone: 'focus',
    };
  }
  return {
    progress: 1,
    overrun: Math.min(1, (elapsedMs - targetMs) / FLOW_EXTENSION_MS),
    label,
    time: `+${clock(elapsedMs - targetMs)}`,
    sub: plan.mode === 'flex' ? 'im Fluss' : 'Ziel erreicht',
    tone: 'focus',
  };
}

/**
 * The readout in `fixed` and `flex` mode: how far through the block or pause
 * the user is, instead of how long they have been going.
 *
 * What the stopwatch counted so far is still shown in the pills beneath it —
 * the entry is the same either way; only the question the big number answers
 * changes. A block that overruns its target in `flex` mode does not stop the
 * ring: it counts the extra time upwards in green on an outer ring.
 */
export const FocusRing: React.FC<FocusRingProps> = ({ plan, phase, calm = false }) => {
  const reading = read(plan, phase);

  const arcStroke =
    reading.tone === 'break' ? 'stroke-amber-500' : calm ? 'stroke-[#7C97FF]' : 'stroke-[#2D5BFF]';
  const trackStroke = calm ? 'stroke-[#272D3D]' : 'stroke-gray-100';
  const muted = calm ? 'text-[#8E97AD]' : 'text-gray-400';
  const overrun = phase?.kind === 'focus' && reading.overrun > 0;

  return (
    <div
      role="timer"
      aria-label={`${reading.label}: ${reading.time} ${reading.sub}`}
      className="relative mx-auto w-full max-w-[18.75rem] aspect-square select-none"
    >
      <svg viewBox="0 0 280 280" className="block w-full h-full" aria-hidden="true">
        <circle cx="140" cy="140" r={RADIUS} fill="none" strokeWidth="10" className={trackStroke} />
        {/* Extra time in a block that overran, drawn outside the ring so the
            block's own progress still reads as complete. */}
        <circle
          cx="140"
          cy="140"
          r={FLOW_RADIUS}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          transform="rotate(-90 140 140)"
          strokeDasharray={`${reading.overrun * FLOW_CIRCUMFERENCE} ${FLOW_CIRCUMFERENCE}`}
          className="stroke-emerald-500 transition-opacity duration-300"
          opacity={overrun ? 1 : 0}
        />
        <circle
          cx="140"
          cy="140"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          transform="rotate(-90 140 140)"
          strokeDasharray={`${reading.progress * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          className={`${arcStroke} motion-safe:transition-[stroke-dasharray] motion-safe:duration-1000 motion-safe:ease-linear`}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
        <span className={`text-[0.6875rem] font-semibold uppercase tracking-[0.2em] ${muted}`}>
          {reading.label}
        </span>
        <span
          className={`text-[clamp(2.25rem,16cqi,3.75rem)] leading-none font-extralight tracking-tighter tabular-nums ${
            overrun ? 'text-emerald-500' : calm ? 'text-[#E9ECF5]' : 'text-[#1A1C1E]'
          }`}
        >
          {reading.time}
        </span>
        <span className={`text-xs max-w-[18ch] ${muted}`}>{reading.sub}</span>
      </div>
    </div>
  );
};
