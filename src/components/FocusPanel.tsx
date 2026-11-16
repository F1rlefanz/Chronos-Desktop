import React from 'react';
import { AppSettings, FocusMode } from '../types';
import { FOCUS_MODE_LABELS, FOCUS_PRESETS } from '../constants/defaultConfig';
import { FocusLengths } from './FocusLengths';

const MODE_HINTS: Record<FocusMode, string> = {
  fixed:
    'Ist der Block um, beginnt die Pause von selbst. Den nächsten Block startest du, die Längen kannst du dann noch ändern.',
  flex: 'Ist der Block um, fragt Chronos: weitermachen oder Pause. Du entscheidest.',
  open: 'Kein festes Ende, die Stoppuhr wie bisher. Nach 90 Minuten am Stück schlägt Chronos eine Pause in der eingestellten Länge vor.',
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
 * Chooses how strictly the stopwatch keeps a rhythm, and for how long.
 *
 * Shown only while nothing is running: the rhythm decides what a block *is*,
 * and changing it halfway through one would move the target under someone who
 * is already working towards it. The lengths can be changed again from the
 * pause between two blocks, see `FocusLengths`.
 */
export const FocusPanel: React.FC<FocusPanelProps> = ({ settings, onChange }) => {
  const { focusMode, focusMinutes, breakMinutes } = settings;

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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-gray-500 mr-1">
            Block / Pause
          </span>
          {FOCUS_PRESETS.map((p) => {
            const active = p.focusMinutes === focusMinutes && p.breakMinutes === breakMinutes;
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
        </div>
      )}

      <FocusLengths settings={settings} onChange={onChange} hideBlock={focusMode === 'open'} />

      <p className="text-sm text-gray-500">{MODE_HINTS[focusMode]}</p>
    </div>
  );
};
