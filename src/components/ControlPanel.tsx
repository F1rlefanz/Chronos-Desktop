import React from 'react';
import { Play, Pause, Flag, Square, RotateCcw, Save } from 'lucide-react';
import { TimerState } from '../types';

interface ControlPanelProps {
  timerState: TimerState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onLap: () => void;
  onStop: () => void;
  onReset: () => void;
  shortcutsEnabled?: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  timerState,
  onStart,
  onPause,
  onResume,
  onLap,
  onStop,
  onReset,
  shortcutsEnabled = true,
}) => {
  return (
    <div className="flex flex-col items-center gap-4 my-6 select-none">
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 w-full">
        {/* START Button */}
        {timerState === 'IDLE' && (
          <button
            onClick={onStart}
            className="flex-1 max-w-xs flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white font-semibold text-lg shadow-xl shadow-blue-500/20 transition-all transform active:scale-95 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>START</span>
            {shortcutsEnabled && (
              <kbd className="hidden sm:inline-block ml-2 text-[10px] font-mono font-normal bg-white/20 text-white px-2 py-0.5 rounded-full">
                Space
              </kbd>
            )}
          </button>
        )}

        {/* PAUSE Button */}
        {timerState === 'RUNNING' && (
          <button
            onClick={onPause}
            className="flex-1 max-w-xs flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-semibold text-lg shadow-xl shadow-amber-500/20 transition-all transform active:scale-95 cursor-pointer"
          >
            <Pause className="w-5 h-5 fill-white" />
            <span>PAUSE</span>
            {shortcutsEnabled && (
              <kbd className="hidden sm:inline-block ml-2 text-[10px] font-mono font-normal bg-white/20 text-white px-2 py-0.5 rounded-full">
                Space
              </kbd>
            )}
          </button>
        )}

        {/* RESUME Button */}
        {timerState === 'PAUSED' && (
          <button
            onClick={onResume}
            className="flex-1 max-w-xs flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white font-semibold text-lg shadow-xl shadow-blue-500/20 transition-all transform active:scale-95 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>RESUME</span>
            {shortcutsEnabled && (
              <kbd className="hidden sm:inline-block ml-2 text-[10px] font-mono font-normal bg-white/20 text-white px-2 py-0.5 rounded-full">
                Space
              </kbd>
            )}
          </button>
        )}

        {/* LAP / SPLIT Button */}
        {(timerState === 'RUNNING' || timerState === 'PAUSED') && (
          <button
            onClick={onLap}
            className="flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm border border-gray-200 shadow-xs transition-all transform active:scale-95 cursor-pointer"
          >
            <Flag className="w-4 h-4 text-[#2D5BFF]" />
            <span>LAP / SPLIT</span>
            {shortcutsEnabled && (
              <kbd className="hidden sm:inline-block ml-1 text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full border border-gray-200">
                L
              </kbd>
            )}
          </button>
        )}

        {/* STOP & SAVE Session Button */}
        {(timerState === 'RUNNING' || timerState === 'PAUSED') && (
          <button
            onClick={onStop}
            className="flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm shadow-md shadow-rose-500/20 transition-all transform active:scale-95 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>STOP & SAVE</span>
            {shortcutsEnabled && (
              <kbd className="hidden sm:inline-block ml-1 text-[10px] font-mono bg-white/20 text-white px-1.5 py-0.5 rounded-full">
                S
              </kbd>
            )}
          </button>
        )}

        {/* RESET Button */}
        {timerState !== 'IDLE' && (
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-2 px-5 py-4 rounded-full bg-gray-100 hover:bg-gray-200/80 text-gray-600 hover:text-gray-900 border border-gray-200 transition-all cursor-pointer text-sm font-semibold"
            title="Reset Timer"
          >
            <RotateCcw className="w-4 h-4 text-gray-500" />
            <span>RESET</span>
            {shortcutsEnabled && (
              <kbd className="hidden sm:inline-block ml-1 text-[10px] font-mono bg-white text-gray-500 px-1.5 py-0.5 rounded-full border border-gray-200">
                R
              </kbd>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
