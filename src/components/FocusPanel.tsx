import React from 'react';
import { AppSettings, FocusMode } from '../types';
import { FOCUS_LIMITS, FOCUS_MODE_LABELS, FOCUS_PRESETS } from '../constants/defaultConfig';
import { clampMinutes } from '../domain/focus';

const MODE_HINTS: Record<FocusMode, string> = {
  fixed:
    'Block und Pause laufen nach Plan. Die Pause beginnt von selbst, den nächsten Block startest du.',
  flex: 'Am Ende des Blocks fragt Chronos. Weitermachen oder Pause, du entscheidest.',
  open: 'Kein festes Ende, die Stoppuhr wie bisher. Nach 90 Minuten am Stück kommt ein Pausenvorschlag.',
};

type FocusSettings = Pick<AppSettings, 'focusMode' | 'focusMinutes' | 'breakMinutes'>;

interface FocusPanelProps {
  settings: FocusSettings;
  onChange: (change: Partial<FocusSettings>) => void;
}

const MODES: FocusMode[] = ['fixed', 'flex', 'open'];

const chip =
  'px-3.5 py-1.5 rounded-full border text-sm font-medium tabular-nums cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5BFF]';

/**
 * Chooses how strictly the stopwatch keeps a rhythm.
 *
 * Shown only while nothing is running: the rhythm decides what a block *is*,
 * and changing it halfway through one would move the target under someone who
 * is already working towards it.
 */
export const FocusPanel: React.FC<FocusPanelProps> = ({ settings, onChange }) => {
  const { focusMode, focusMinutes, breakMinutes } = settings;
  const preset = FOCUS_PRESETS.find(
    (p) => p.focusMinutes === focusMinutes && p.breakMinutes === breakMinutes
  );
  const custom = !preset;

  const step = (field: 'focusMinutes' | 'breakMinutes', delta: number) =>
    onChange({ [field]: clampMinutes(settings[field] + delta, FOCUS_LIMITS[field]) });

  return (
    <div className="mt-8 space-y-4 text-left" aria-label="Arbeitsrhythmus" role="group">
      <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-gray-50 border border-gray-200/80">
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={focusMode === mode}
            onClick={() => onChange({ focusMode: mode })}
            className={`py-2 rounded-xl text-sm font-semibold cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5BFF] ${
              focusMode === mode
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {FOCUS_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {focusMode !== 'open' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-gray-400 mr-1">
              Block / Pause
            </span>
            {FOCUS_PRESETS.map((p) => {
              const active = preset === p;
              return (
                <button
                  key={p.focusMinutes}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange({ focusMinutes: p.focusMinutes, breakMinutes: p.breakMinutes })
                  }
                  className={`${chip} ${
                    active
                      ? 'bg-[#2D5BFF] border-[#2D5BFF] text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {p.focusMinutes} / {p.breakMinutes}
                </button>
              );
            })}
            <span
              aria-hidden={!custom}
              className={`${chip} ${
                custom
                  ? 'bg-[#2D5BFF] border-[#2D5BFF] text-white'
                  : 'bg-gray-50 border-gray-200 text-gray-400'
              }`}
            >
              Eigene
            </span>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-700">
            <Stepper
              label="Block"
              value={focusMinutes}
              onMinus={() => step('focusMinutes', -5)}
              onPlus={() => step('focusMinutes', 5)}
            />
            <Stepper
              label="Pause"
              value={breakMinutes}
              onMinus={() => step('breakMinutes', -1)}
              onPlus={() => step('breakMinutes', 1)}
            />
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500">{MODE_HINTS[focusMode]}</p>
    </div>
  );
};

const Stepper: React.FC<{
  label: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
}> = ({ label, value, onMinus, onPlus }) => {
  const button =
    'w-8 h-8 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100 text-base leading-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5BFF]';
  return (
    <span className="inline-flex items-center gap-2">
      {label}
      <button type="button" className={button} onClick={onMinus} aria-label={`${label} kürzer`}>
        −
      </button>
      <output className="min-w-[4.5ch] text-center font-semibold tabular-nums">{value} Min.</output>
      <button type="button" className={button} onClick={onPlus} aria-label={`${label} länger`}>
        +
      </button>
    </span>
  );
};
