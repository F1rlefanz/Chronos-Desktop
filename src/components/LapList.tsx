import React from 'react';
import { Lap } from '../types';
import { formatTimeDisplay } from '../utils/timeFormatters';
import { Flag, Trophy, Flame } from 'lucide-react';

interface LapListProps {
  laps: Lap[];
}

export const LapList: React.FC<LapListProps> = ({ laps }) => {
  if (laps.length === 0) return null;

  // Calculate fastest and slowest lap for visual highlight
  let minLapTime = Infinity;
  let maxLapTime = -Infinity;

  if (laps.length >= 2) {
    laps.forEach((lap) => {
      if (lap.lapTimeMs < minLapTime) minLapTime = lap.lapTimeMs;
      if (lap.lapTimeMs > maxLapTime) maxLapTime = lap.lapTimeMs;
    });
  }

  // With identical lap times min === max, which would tag every lap as both
  // fastest and slowest. Only highlight when the laps actually differ.
  const hasSpread = laps.length >= 2 && minLapTime !== maxLapTime;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 my-4">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
          <Flag className="w-4 h-4 text-[#2D5BFF]" />
          <span>Lap Breakdown & Splits</span>
          <span className="text-xs bg-gray-100 text-gray-600 font-normal px-2.5 py-0.5 rounded-full">
            {laps.length} {laps.length === 1 ? 'lap' : 'laps'}
          </span>
        </h3>
        <span className="text-[10px] text-gray-400 font-mono tracking-wider">NEWEST FIRST</span>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {laps.map((lap) => {
          const isFastest = hasSpread && lap.lapTimeMs === minLapTime;
          const isSlowest = hasSpread && lap.lapTimeMs === maxLapTime;

          const lapDisplay = formatTimeDisplay(lap.lapTimeMs, { includeMilliseconds: true });
          const splitDisplay = formatTimeDisplay(lap.splitTimeMs, { includeMilliseconds: true });

          return (
            <div
              key={lap.id}
              className={`flex items-center justify-between p-3 rounded-xl border text-xs font-mono transition-colors ${
                isFastest
                  ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                  : isSlowest
                    ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                    : 'bg-gray-50/70 border-gray-200/80 text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-500 w-12">
                  Lap {String(lap.lapNumber).padStart(2, '0')}
                </span>
                {isFastest && (
                  <span className="flex items-center gap-1 text-[10px] bg-[#2D5BFF] text-white px-2 py-0.5 rounded-full font-sans font-medium">
                    <Trophy className="w-3 h-3 text-white" /> Fastest
                  </span>
                )}
                {isSlowest && (
                  <span className="flex items-center gap-1 text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-sans font-medium">
                    <Flame className="w-3 h-3 text-white" /> Slowest
                  </span>
                )}
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[10px] text-gray-400 block font-sans uppercase tracking-wider">
                    Lap Time
                  </span>
                  <span className="font-semibold text-gray-900">
                    {lapDisplay.mainTime}
                    <span className="text-[#2D5BFF] text-[10px] ml-0.5">{lapDisplay.subTime}</span>
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-gray-400 block font-sans uppercase tracking-wider">
                    Total Split
                  </span>
                  <span className="text-gray-500">
                    {splitDisplay.mainTime}
                    <span className="text-gray-400 text-[10px] ml-0.5">{splitDisplay.subTime}</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
