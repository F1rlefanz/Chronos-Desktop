import React from 'react';
import { TimeEntry } from '../types';
import { netMs } from '../domain/timeEntry';
import { formatDateTime, formatDurationHuman } from '../utils/timeFormatters';
import { AlertTriangle, Pencil, Play, Square } from 'lucide-react';

interface RecoveryPromptProps {
  entry: TimeEntry;
  onContinue: () => void;
  onStopNow: () => void;
  onEdit: () => void;
}

/**
 * Shown at startup when a measurement was still running the last time the app
 * was closed — after a crash, a reboot, or simply closing the window.
 *
 * The entry itself was never at risk: it is written to storage the moment the
 * measurement starts. What needs deciding is what the elapsed time *means*. A
 * measurement left running overnight is almost never eight hours of work, so
 * silently resuming would quietly invent time; refusing to resume would throw
 * away a legitimate one. Asking is the only honest option, which is why this
 * cannot be a toast.
 */
export const RecoveryPrompt: React.FC<RecoveryPromptProps> = ({
  entry,
  onContinue,
  onStopNow,
  onEdit,
}) => {
  const elapsed = netMs(entry);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs animate-fade-in"
    >
      <div className="bg-white border border-gray-200/90 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden text-gray-900">
        <div className="flex items-center gap-2 px-6 py-4 bg-amber-50 border-b border-amber-200 text-amber-800">
          <AlertTriangle className="w-5 h-5" />
          <h2 id="recovery-title" className="font-semibold text-base">
            A measurement was still running
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-1">
            <p className="text-sm font-bold text-gray-900">{entry.title || 'Untitled Session'}</p>
            <p className="text-xs text-gray-500">Started {formatDateTime(entry.startTime)}</p>
            <p className="text-xs text-gray-500">
              Counted so far:{' '}
              <strong className="text-[#2D5BFF]">{formatDurationHuman(elapsed)}</strong>
            </p>
          </div>

          <p className="text-xs text-gray-500">
            Nothing has been lost. Decide what this time should count as.
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={onContinue}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Keep it running</span>
            </button>

            <div className="flex gap-2">
              <button
                onClick={onStopNow}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop now</span>
              </button>
              <button
                onClick={onEdit}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Correct the times</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
