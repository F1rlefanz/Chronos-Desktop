import React, { useMemo, useState } from 'react';
import { Break, Project, TimeEntry } from '../types';
import { breakMs, isRunning, netMs, validateEntryInput } from '../domain/timeEntry';
import {
  formatDurationHuman,
  fromDateTimeInputValue,
  toDateTimeInputValue,
} from '../utils/timeFormatters';
import { Clock, Folder, FileText, Plus, Save, Tag, Trash2, X } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { ConfirmPrompt } from './ConfirmPrompt';

/**
 * What the form hands back; the caller supplies id, createdAt, updatedAt and
 * source. `updatedAt` in particular is the caller's to set: the form does not
 * know whether this is a new entry or a correction, and stamping it here would
 * mean trusting a component to get the merge-relevant field right.
 */
export type EntryDraft = Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt' | 'source'>;

interface EntryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: EntryDraft) => void;
  /** The entry being changed, or `null` to add one that never ran. */
  entry: TimeEntry | null;
  projects: Project[];
  defaultProjectId: string;
}

const FIELD =
  'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 ' +
  'focus:outline-none focus:border-[#2D5BFF] focus:bg-white transition-colors';

function newBreakId(): string {
  return `break-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/** Rounded to the minute, because the form only offers minute precision. */
function nowToTheMinute(): number {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

export const EntryFormModal: React.FC<EntryFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  entry,
  projects,
  defaultProjectId,
}) => {
  const isEditing = entry !== null;
  const startedRunning = entry !== null && isRunning(entry);

  const [title, setTitle] = useState(entry?.title ?? '');
  const [projectId, setProjectId] = useState(entry?.project || defaultProjectId);
  const [tagInput, setTagInput] = useState((entry?.tags ?? []).join(', '));
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [startValue, setStartValue] = useState(
    toDateTimeInputValue(entry?.startTime ?? nowToTheMinute())
  );
  const [keepRunning, setKeepRunning] = useState(startedRunning);
  const [endValue, setEndValue] = useState(
    toDateTimeInputValue(entry?.endTime ?? nowToTheMinute())
  );
  const [breaks, setBreaks] = useState<Break[]>(entry?.breaks ?? []);

  const startTime = fromDateTimeInputValue(startValue);
  const endTime = keepRunning ? null : fromDateTimeInputValue(endValue);

  const draft = useMemo(() => ({ startTime, endTime, breaks }), [startTime, endTime, breaks]);

  const validation = useMemo(() => validateEntryInput(draft), [draft]);
  const preview = validation.errors.length === 0 ? netMs(draft) : null;

  /**
   * The warnings a save is waiting to have confirmed.
   *
   * Above the early return with the other hooks, not next to the submit handler
   * where it reads better: this component returns `null` when closed, and a
   * hook after that runs in some renders and not others.
   *
   * Held at all rather than asked inline because asking is a render now — the
   * browser dialog this used to use draws nothing in the Android WebView and
   * answers yes, so every warning here was waved through on a phone.
   */
  const [warningsToConfirm, setWarningsToConfirm] = useState<string[] | null>(null);

  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const addBreak = () => {
    // Anchored inside the entry so a fresh row starts valid rather than
    // greeting the user with an error they did not cause.
    const anchor = Number.isFinite(startTime) ? startTime : nowToTheMinute();
    setBreaks([...breaks, { id: newBreakId(), startTime: anchor, endTime: anchor }]);
  };

  const updateBreak = (id: string, patch: Partial<Break>) => {
    setBreaks(breaks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const removeBreak = (id: string) => {
    setBreaks(breaks.filter((b) => b.id !== id));
  };

  const save = () => {
    onSave({
      title: title.trim() || 'Ohne Titel',
      project: projectId,
      tags: tagInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
      startTime,
      endTime,
      breaks,
      notes: notes.trim(),
    });

    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validation.errors.length > 0) return;

    if (validation.warnings.length > 0) {
      setWarningsToConfirm(validation.warnings);
      return;
    }

    save();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-gray-200/90 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-gray-900 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50/80 border-b border-gray-200">
          <div className="flex items-center gap-2 text-[#2D5BFF] font-semibold text-base">
            <Clock className="w-5 h-5" />
            <span>{isEditing ? 'Eintrag bearbeiten' : 'Eintrag hinzufügen'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto overscroll-contain">
          {/* Times. Each end carries its own date, so an entry over midnight is
              just two timestamps — no "date of the entry" to contradict. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="entry-start"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Beginn
              </label>
              <input
                id="entry-start"
                type="datetime-local"
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
                className={FIELD}
                required
              />
            </div>
            <div>
              <label htmlFor="entry-end" className="block text-xs font-semibold text-gray-700 mb-1">
                Ende
              </label>
              <input
                id="entry-end"
                type="datetime-local"
                value={endValue}
                onChange={(e) => setEndValue(e.target.value)}
                disabled={keepRunning}
                className={`${FIELD} disabled:opacity-40 disabled:cursor-not-allowed`}
                required={!keepRunning}
              />
            </div>
          </div>

          {/* Only offered for an entry that is already running: saving must not
              be the thing that quietly stops a measurement. */}
          {startedRunning && (
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={keepRunning}
                onChange={(e) => setKeepRunning(e.target.checked)}
                className="rounded bg-gray-50 border-gray-300 text-[#2D5BFF] focus:ring-0"
              />
              <span>
                Erfassung weiterlaufen lassen
                {!keepRunning && (
                  <strong className="text-rose-600"> — Speichern beendet die Erfassung</strong>
                )}
              </span>
            </label>
          )}

          {/* Breaks keep their own timestamps instead of collapsing into one
              total on save, which would throw away when each pause happened. */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-700">
                Pausen{' '}
                {breaks.length > 0 && (
                  <span className="font-normal text-gray-400">
                    (zusammen {formatDurationHuman(breakMs(draft))})
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={addBreak}
                className="flex items-center gap-1 text-[0.6875rem] font-semibold text-[#2D5BFF] hover:text-blue-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Pause hinzufügen</span>
              </button>
            </div>

            {breaks.length === 0 ? (
              <p className="text-[0.6875rem] text-gray-400">Keine Pausen erfasst.</p>
            ) : (
              <div className="space-y-2">
                {breaks.map((pause) => (
                  <div key={pause.id} className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      aria-label="Pausenbeginn"
                      value={toDateTimeInputValue(pause.startTime)}
                      onChange={(e) =>
                        updateBreak(pause.id, {
                          startTime: fromDateTimeInputValue(e.target.value),
                        })
                      }
                      className={`${FIELD} text-xs`}
                    />
                    <span className="text-gray-300 text-xs">–</span>
                    <input
                      type="datetime-local"
                      aria-label="Pausenende"
                      value={pause.endTime === null ? '' : toDateTimeInputValue(pause.endTime)}
                      onChange={(e) =>
                        updateBreak(pause.id, {
                          endTime: e.target.value ? fromDateTimeInputValue(e.target.value) : null,
                        })
                      }
                      className={`${FIELD} text-xs`}
                    />
                    <button
                      type="button"
                      onClick={() => removeBreak(pause.id)}
                      aria-label="Pause entfernen"
                      className="p-1.5 shrink-0 rounded-full text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="entry-title" className="block text-xs font-semibold text-gray-700 mb-1">
              Titel
            </label>
            <input
              id="entry-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Unterricht vorbereitet"
              className={FIELD}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="entry-project"
                className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1"
              >
                <Folder className="w-3.5 h-3.5 text-[#2D5BFF]" />
                <span>Projekt</span>
              </label>
              <select
                id="entry-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={`${FIELD} cursor-pointer`}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="entry-tags"
                className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1"
              >
                <Tag className="w-3.5 h-3.5 text-purple-500" />
                <span>Schlagwörter</span>
              </label>
              <input
                id="entry-tags"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Besprechung, Vorbereitung"
                className={FIELD}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="entry-notes"
              className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>Notiz</span>
            </label>
            <textarea
              id="entry-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${FIELD} resize-none`}
            />
          </div>

          {/* Errors block the save; warnings are raised on submit instead, so
              an unusual but correct entry is never made impossible. */}
          {validation.errors.length > 0 ? (
            <ul role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-1">
              {validation.errors.map((error) => (
                <li key={error} className="text-xs text-red-800">
                  {error}
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              Arbeitszeit:{' '}
              <strong className="text-[#2D5BFF]">{formatDurationHuman(preview ?? 0)}</strong>
              {keepRunning && <span className="text-gray-400"> — läuft weiter</span>}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full text-xs font-medium text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={validation.errors.length > 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#2D5BFF] hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isEditing ? 'Änderungen speichern' : 'Eintrag anlegen'}</span>
            </button>
          </div>
        </form>
      </div>

      {warningsToConfirm && (
        <ConfirmPrompt
          request={{
            title: 'Trotzdem speichern?',
            lines: warningsToConfirm,
            confirmLabel: 'Speichern',
            tone: 'neutral',
          }}
          onConfirm={() => {
            setWarningsToConfirm(null);
            save();
          }}
          onCancel={() => setWarningsToConfirm(null)}
        />
      )}
    </div>
  );
};
