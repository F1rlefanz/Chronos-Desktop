import React, { useState } from 'react';
import { Project, TimeEntry } from '../types';
import { breakMs, netMs } from '../domain/timeEntry';
import { formatTimeDisplay, formatDurationHuman } from '../utils/timeFormatters';
import { Save, Tag, Folder, FileText, Check, Trash2 } from 'lucide-react';

interface SessionSaverModalProps {
  isOpen: boolean;
  /** The measurement that just ended. It is already stored by this point. */
  entry: TimeEntry;
  projects: Project[];
  onSave: (patch: Pick<TimeEntry, 'title' | 'project' | 'tags' | 'notes'>) => void;
  onDiscard: () => void;
  onClose: () => void;
}

/**
 * Asks what the time that was just measured was spent on.
 *
 * Note what this dialog no longer does: it does not create the entry. The
 * measurement was written to storage when it started and closed when it
 * stopped, so this only adds a label. Dismissing it therefore costs a title
 * rather than the recorded hours — which is why there is no "Cancel" that
 * silently drops everything, and why throwing the session away is a separate,
 * explicit button that says it deletes.
 */
export const SessionSaverModal: React.FC<SessionSaverModalProps> = ({
  isOpen,
  entry,
  projects,
  onSave,
  onDiscard,
  onClose,
}) => {
  const [title, setTitle] = useState<string>(entry.title);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    entry.project || projects[0]?.id || 'proj-work'
  );
  const [tagInput, setTagInput] = useState<string>(entry.tags.join(', '));
  const [notes, setNotes] = useState<string>(entry.notes ?? '');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSave({
      title: title.trim() || 'Ohne Titel',
      project: selectedProjectId,
      tags: tagInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
      notes: notes.trim(),
    });
  };

  const recordedMs = netMs(entry);
  const pausedMs = breakMs(entry);
  const { mainTime, subTime } = formatTimeDisplay(recordedMs, { includeMilliseconds: true });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-gray-200/90 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-gray-900">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50/80 border-b border-gray-200">
          <div className="flex items-center gap-2 text-[#2D5BFF] font-semibold text-base">
            <Save className="w-5 h-5" />
            <span>Erfassung benennen</span>
          </div>
          <span className="text-[11px] text-gray-400">Bereits gespeichert</span>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Duration Summary Ribbon */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-400 block font-medium">Erfasste Zeit</span>
              <span className="text-2xl font-mono font-bold text-gray-900">
                {mainTime}
                <span className="text-[#2D5BFF] text-sm">{subTime}</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400 block font-medium">Arbeitszeit</span>
              <span className="text-sm font-semibold text-[#2D5BFF]">
                {formatDurationHuman(recordedMs)}
              </span>
              {pausedMs > 0 && (
                <span className="block text-[10px] text-gray-400">
                  abzüglich {formatDurationHuman(pausedMs)} Pause
                </span>
              )}
            </div>
          </div>

          {/* Session Title */}
          <div>
            <label htmlFor="saver-title" className="block text-xs font-semibold text-gray-700 mb-1">
              Titel
            </label>
            <input
              id="saver-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Unterricht vorbereitet"
              className="w-full bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#2D5BFF] focus:bg-white transition-colors"
              autoFocus
            />
          </div>

          {/* Project Categorization */}
          <div>
            <label
              htmlFor="saver-project"
              className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1"
            >
              <Folder className="w-3.5 h-3.5 text-[#2D5BFF]" />
              <span>Projekt</span>
            </label>
            <select
              id="saver-project"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#2D5BFF] focus:bg-white transition-colors cursor-pointer"
            >
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label
              htmlFor="saver-tags"
              className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1"
            >
              <Tag className="w-3.5 h-3.5 text-purple-500" />
              <span>Schlagwörter (mit Komma trennen)</span>
            </label>
            <input
              id="saver-tags"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Besprechung, Vorbereitung"
              className="w-full bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#2D5BFF] focus:bg-white transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="saver-notes"
              className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>Notiz (optional)</span>
            </label>
            <textarea
              id="saver-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Kurz festhalten, woran gearbeitet wurde…"
              rows={3}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#2D5BFF] focus:bg-white transition-colors resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={onDiscard}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-medium text-rose-600 hover:text-white hover:bg-rose-500 bg-rose-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eintrag löschen</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-full text-xs font-medium text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Später
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Speichern</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
