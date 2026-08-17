import React from 'react';
import { AlertTriangle, Check, Undo2 } from 'lucide-react';
import { TimeEntry } from '../types';
import { netMs } from '../domain/timeEntry';
import { formatDateOnly, formatDurationHuman } from '../utils/timeFormatters';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface DeletionPromptProps {
  /** The entries this device would lose, newest first. */
  entries: TimeEntry[];
  onAdopt: () => void;
  onKeep: () => void;
}

/** Enough to recognise a record without turning the dialog into the history. */
const SHOWN = 5;

/**
 * Asked before a sync removes entries this device still has.
 *
 * Every other outcome of a merge adds something. This one takes recorded time
 * away, and it is the only one where the reply arrives after the fact: the
 * summary line said "11 gelöscht" once they were already gone. The merge rule
 * is not wrong — a deletion wins over an older edit, which is what makes
 * deleting on a phone work at all — but "correct" and "expected" are different
 * things when it is a week of work.
 *
 * Which is why this lists them rather than counting them. A number cannot be
 * checked against memory; a title and a date can, and the difference between
 * "yes, I cleared those" and "what is that doing there" is the whole reason to
 * ask at all.
 *
 * Deliberately not a threshold. One entry lost by surprise is the same kind of
 * wrong as eleven, and a rule that only speaks up above some count is a rule
 * nobody can predict.
 */
export const DeletionPrompt: React.FC<DeletionPromptProps> = ({ entries, onAdopt, onKeep }) => {
  // No isOpen: the parent mounts this only when there is something to ask
  // about, exactly as RecoveryPrompt does.
  useBodyScrollLock(true);

  const shown = entries.slice(0, SHOWN);
  const rest = entries.length - shown.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deletion-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs animate-fade-in"
    >
      <div className="bg-white border border-gray-200/90 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-gray-900">
        <div className="flex items-center gap-2 px-6 py-4 bg-amber-50 border-b border-amber-200 text-amber-800 shrink-0">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <h2 id="deletion-title" className="font-semibold text-base">
            {entries.length === 1
              ? 'Das andere Gerät hat einen Eintrag gelöscht'
              : `Das andere Gerät hat ${entries.length} Einträge gelöscht`}
          </h2>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto overscroll-contain custom-scrollbar">
          <ul className="rounded-2xl border border-gray-200 bg-gray-50 divide-y divide-gray-200">
            {shown.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-0.5 p-3 sm:flex-row sm:items-baseline"
              >
                {/* min-w-0 with the duration allowed to shrink away instead:
                    a long title must truncate, never slide under the time. */}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                  {entry.title || 'Ohne Titel'}
                </span>
                <span className="shrink-0 text-xs text-gray-500 sm:ml-3">
                  {formatDateOnly(entry.startTime)} · {formatDurationHuman(netMs(entry))}
                </span>
              </li>
            ))}
          </ul>

          {rest > 0 && (
            <p className="text-xs text-gray-500">
              … und {rest} {rest === 1 ? 'weiterer Eintrag' : 'weitere Einträge'}.
            </p>
          )}

          <p className="text-xs text-gray-500">
            <strong className="text-gray-700">Übernehmen</strong> heißt: sie verschwinden auch hier.
            Eine Sicherung von vorher liegt im Backup-Ordner.{' '}
            <strong className="text-gray-700">Behalten</strong> bricht den ganzen Abgleich ab —
            dieses Gerät bleibt, wie es ist, und beim nächsten Mal wird wieder gefragt.
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={onKeep}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition-colors cursor-pointer"
            >
              <Undo2 className="w-4 h-4" />
              <span>Behalten</span>
            </button>
            <button
              onClick={onAdopt}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-xs transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Übernehmen</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
