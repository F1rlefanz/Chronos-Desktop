import React from 'react';
import { Break } from '../types';
import { breakDurationMs, isBreakRunning } from '../domain/timeEntry';
import { formatDurationHuman } from '../utils/timeFormatters';
import { Coffee, Pause } from 'lucide-react';

interface BreakListProps {
  breaks: Break[];
  /** Shared clock, so a running pause and the total agree to the second. */
  now: number;
}

/**
 * The pauses of the entry currently being recorded.
 *
 * This is where the lap list used to be. A lap was a split time — a fact about
 * a stopwatch run, with nothing to say about worked hours — whereas a pause is
 * part of the record and is what the net duration is computed against, so the
 * same spot in the layout now shows something the user can act on.
 */
export const BreakList: React.FC<BreakListProps> = ({ breaks, now }) => {
  if (breaks.length === 0) return null;

  const total = breaks.reduce((sum, pause) => sum + breakDurationMs(pause, now), 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 my-4">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
          <Coffee className="w-4 h-4 text-amber-500" />
          <span>Breaks</span>
          <span className="text-xs bg-gray-100 text-gray-600 font-normal px-2.5 py-0.5 rounded-full">
            {breaks.length} {breaks.length === 1 ? 'break' : 'breaks'}
          </span>
        </h3>
        <span className="text-[11px] text-gray-500">
          Not counted as work:{' '}
          <strong className="text-gray-800">{formatDurationHuman(total)}</strong>
        </span>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {breaks.map((pause, index) => {
          const running = isBreakRunning(pause);
          const duration = breakDurationMs(pause, now);

          return (
            <div
              key={pause.id}
              className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-colors ${
                running
                  ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                  : 'bg-gray-50/70 border-gray-200/80 text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-500 font-mono w-12">
                  #{String(index + 1).padStart(2, '0')}
                </span>
                {running && (
                  <span className="flex items-center gap-1 text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-medium">
                    <Pause className="w-3 h-3 fill-white" /> Ongoing
                  </span>
                )}
              </div>

              <span className="font-mono font-semibold text-gray-900">
                {formatDurationHuman(duration)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
