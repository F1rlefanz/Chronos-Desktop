import React from 'react';
import { TimerState } from '../types';
import { formatTimeDisplay, parseMsToComponents } from '../utils/timeFormatters';
import { Pause } from 'lucide-react';

interface StopwatchDisplayProps {
  elapsedTimeMs: number;
  timerState: TimerState;
  showMilliseconds: boolean;
  lapCount: number;
  selectedProjectName: string;
  selectedProjectColor: string;
}

export const StopwatchDisplay: React.FC<StopwatchDisplayProps> = ({
  elapsedTimeMs,
  timerState,
  showMilliseconds,
  lapCount,
  selectedProjectName,
  selectedProjectColor,
}) => {
  const { mainTime, subTime } = formatTimeDisplay(elapsedTimeMs, {
    includeMilliseconds: showMilliseconds,
    alwaysShowHours: false,
  });

  const { hours, seconds } = parseMsToComponents(elapsedTimeMs);
  const totalMinutes = Math.floor(elapsedTimeMs / (1000 * 60));

  return (
    <div className="relative bg-white rounded-3xl border border-gray-200/90 shadow-sm p-8 md:p-12 transition-all duration-300 overflow-hidden">
      {/* Decorative Minimalist Circle Rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] sm:w-[460px] sm:h-[460px] border border-gray-100 rounded-full pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] sm:w-[560px] sm:h-[560px] border border-gray-100/60 rounded-full pointer-events-none"></div>

      {/* Top Bar inside Display Card */}
      <div className="relative z-10 flex items-center justify-between mb-8">
        {/* Project Badge */}
        <div className="flex items-center gap-2 bg-gray-50 px-3.5 py-1.5 rounded-full border border-gray-200/80 shadow-2xs">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: selectedProjectColor || '#2D5BFF' }}
          />
          <span className="text-xs font-semibold text-gray-700">{selectedProjectName}</span>
        </div>

        {/* Timer Status Badge */}
        <div className="flex items-center gap-2">
          {timerState === 'RUNNING' && (
            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-[#2D5BFF] border border-blue-200/80 text-xs font-semibold px-3.5 py-1 rounded-full animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#2D5BFF]"></span>
              TRACKING ACTIVE
            </span>
          )}
          {timerState === 'PAUSED' && (
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 border border-amber-200 text-xs font-semibold px-3.5 py-1 rounded-full">
              <Pause className="w-3 h-3 fill-amber-500" />
              PAUSED
            </span>
          )}
          {timerState === 'IDLE' && (
            <span className="text-xs font-medium text-gray-500 bg-gray-50 px-3.5 py-1 rounded-full border border-gray-200">
              READY
            </span>
          )}
        </div>
      </div>

      {/* Main Digital Clock Display */}
      <div className="relative z-10 text-center py-2 my-2">
        <div className="inline-flex items-baseline justify-center font-extralight tracking-tighter text-[#1A1C1E] select-none">
          <span className="text-7xl sm:text-8xl md:text-9xl lg:text-[130px] leading-none font-extralight">
            {mainTime}
          </span>
          {showMilliseconds && (
            <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#2D5BFF] font-light ml-1.5 w-16 sm:w-24 text-left font-mono">
              {subTime}
            </span>
          )}
        </div>

        {/* Labels below time */}
        <div className="mt-3 text-gray-400 uppercase tracking-[0.25em] text-[11px] font-semibold">
          {mainTime.split(':').length > 2 ? 'Hours : Minutes : Seconds' : 'Minutes : Seconds'}
          {showMilliseconds && <span className="text-[#2D5BFF] font-bold"> : MS</span>}
        </div>

        {/* Secondary Detailed Readouts */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-gray-500 mt-6">
          <span className="bg-gray-50 px-3.5 py-1.5 rounded-full border border-gray-200/80 text-gray-700">
            Total: <strong className="text-gray-900">{totalMinutes}m {seconds}s</strong>
          </span>
          {hours > 0 && (
            <span className="bg-gray-50 px-3.5 py-1.5 rounded-full border border-gray-200/80 text-gray-700">
              Hours: <strong className="text-gray-900">{(elapsedTimeMs / (1000 * 60 * 60)).toFixed(2)}h</strong>
            </span>
          )}
          {lapCount > 0 && (
            <span className="bg-blue-50 text-[#2D5BFF] border border-blue-200/80 px-3.5 py-1.5 rounded-full font-semibold">
              Laps: {lapCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
