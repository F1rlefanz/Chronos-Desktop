import React, { ReactNode } from 'react';
import { Project, TimerState } from '../types';
import {
  formatDurationHuman,
  formatTimeDisplay,
  parseMsToComponents,
} from '../utils/timeFormatters';
import { Pause } from 'lucide-react';

interface StopwatchDisplayProps {
  elapsedTimeMs: number;
  timerState: TimerState;
  showMilliseconds: boolean;
  breakCount: number;
  /** The picker lives here rather than in a bar of its own: one control in one
      place, instead of choosing above and reading the choice back below. */
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  /** The start/pause/stop controls, rendered inside the card rather than
      below it — they operate on this readout and belong with it. Passed as
      children so this component stays presentational and knows nothing about
      the timer's handlers. */
  children?: ReactNode;
}

export const StopwatchDisplay: React.FC<StopwatchDisplayProps> = ({
  elapsedTimeMs,
  timerState,
  showMilliseconds,
  breakCount,
  projects,
  activeProjectId,
  onSelectProject,
  children,
}) => {
  const { mainTime, subTime } = formatTimeDisplay(elapsedTimeMs, {
    includeMilliseconds: showMilliseconds,
    alwaysShowHours: false,
  });

  const { hours } = parseMsToComponents(elapsedTimeMs);

  const activeProject = projects.find((project) => project.id === activeProjectId);

  return (
    // `@container` rather than the viewport: from `xl` up this card sits in a
    // column beside the history, so a readout sized in `vw` would be sized
    // against a screen it no longer spans. `cqi` asks the card itself.
    <section
      aria-label="Zeiterfassung"
      className="@container relative bg-white rounded-3xl border border-gray-200/90 shadow-sm p-8 md:p-12 transition-all duration-300 overflow-hidden"
    >
      {/* Decorative Minimalist Circle Rings. In `rem` so they follow the root
          scale on a very large screen instead of staying laptop-sized. */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[21.25rem] h-[21.25rem] sm:w-[28.75rem] sm:h-[28.75rem] border border-gray-100 rounded-full pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[26.25rem] h-[26.25rem] sm:w-[35rem] sm:h-[35rem] border border-gray-100/60 rounded-full pointer-events-none"></div>

      {/* Top Bar inside Display Card */}
      <div className="relative z-10 flex items-center justify-between mb-8">
        {/* Project picker */}
        <div className="flex items-center gap-2 bg-gray-50 pl-3.5 pr-1.5 py-1 rounded-full border border-gray-200/80 shadow-2xs">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: activeProject?.color || '#2D5BFF' }}
          />
          <select
            value={activeProjectId}
            onChange={(e) => onSelectProject(e.target.value)}
            aria-label="Projekt"
            className="bg-transparent text-xs font-semibold text-gray-700 py-0.5 pr-1 focus:outline-none cursor-pointer"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Timer Status Badge */}
        <div className="flex items-center gap-2">
          {timerState === 'RUNNING' && (
            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-[#2D5BFF] border border-blue-200/80 text-xs font-semibold px-3.5 py-1 rounded-full animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#2D5BFF]"></span>
              ERFASSUNG LÄUFT
            </span>
          )}
          {timerState === 'PAUSED' && (
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 border border-amber-200 text-xs font-semibold px-3.5 py-1 rounded-full">
              <Pause className="w-3 h-3 fill-amber-500" />
              PAUSIERT
            </span>
          )}
          {timerState === 'IDLE' && (
            <span className="text-xs font-medium text-gray-500 bg-gray-50 px-3.5 py-1 rounded-full border border-gray-200">
              BEREIT
            </span>
          )}
        </div>
      </div>

      {/* Main Digital Clock Display */}
      <div className="relative z-10 text-center py-2 my-2">
        <div className="inline-flex items-baseline justify-center font-extralight tracking-tighter text-[#1A1C1E] select-none">
          {/* One curve instead of four steps. The upper bound is the old
              `130px`; the slope is set so the widest thing this ever shows —
              `HH:MM:SS` with hundredths beside it — still fits the card at 320
              pixels, where the fixed sizes ran past the edge once a measurement
              passed an hour. */}
          <span className="text-[clamp(2.5rem,23cqi,8rem)] leading-none font-extralight">
            {mainTime}
          </span>
          {showMilliseconds && (
            <span className="text-[clamp(1rem,8cqi,3.75rem)] text-[#2D5BFF] font-light ml-1.5 w-[2.4em] text-left font-mono">
              {subTime}
            </span>
          )}
        </div>

        {/* Labels below time */}
        <div className="mt-3 text-gray-400 uppercase tracking-[0.25em] text-[0.6875rem] font-semibold">
          {mainTime.split(':').length > 2 ? 'Stunden : Minuten : Sekunden' : 'Minuten : Sekunden'}
          {showMilliseconds && <span className="text-[#2D5BFF] font-bold"> : MS</span>}
        </div>

        {/* Secondary Detailed Readouts */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-gray-500 mt-6">
          <span className="bg-gray-50 px-3.5 py-1.5 rounded-full border border-gray-200/80 text-gray-700">
            Gesamt: <strong className="text-gray-900">{formatDurationHuman(elapsedTimeMs)}</strong>
          </span>
          {hours > 0 && (
            <span className="bg-gray-50 px-3.5 py-1.5 rounded-full border border-gray-200/80 text-gray-700">
              {/* Decimal hours, which is the unit a timesheet is billed in. */}
              Dezimal:{' '}
              <strong className="text-gray-900">
                {(elapsedTimeMs / (1000 * 60 * 60)).toFixed(2).replace('.', ',')} h
              </strong>
            </span>
          )}
          {breakCount > 0 && (
            <span className="bg-amber-50 text-amber-700 border border-amber-200/80 px-3.5 py-1.5 rounded-full font-semibold">
              Pausen: {breakCount}
            </span>
          )}
        </div>
      </div>

      {children && <div className="relative z-10">{children}</div>}
    </section>
  );
};
