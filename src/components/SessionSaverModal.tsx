import React, { useState } from 'react';
import { Project, TimeEntry } from '../types';
import { StopwatchResult } from '../hooks/useStopwatch';
import { breakMs, netMs } from '../domain/timeEntry';
import { formatTimeDisplay, formatDurationHuman } from '../utils/timeFormatters';
import { Save, Tag, Folder, FileText, Check, X } from 'lucide-react';

interface SessionSaverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entryData: Omit<TimeEntry, 'id' | 'createdAt' | 'source'>) => void;
  /** The finished run: start, end and pauses. The duration is derived. */
  recorded: StopwatchResult;
  projects: Project[];
  defaultProjectId: string;
}

export const SessionSaverModal: React.FC<SessionSaverModalProps> = ({
  isOpen,
  onClose,
  onSave,
  recorded,
  projects,
  defaultProjectId,
}) => {
  const [title, setTitle] = useState<string>('Recorded Time Session');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    defaultProjectId || projects[0]?.id || 'proj-work'
  );
  const [tagInput, setTagInput] = useState<string>('work, focused');
  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onSave({
      title: title.trim() || 'Untitled Session',
      project: selectedProjectId,
      tags,
      startTime: recorded.startTime,
      endTime: recorded.endTime,
      breaks: recorded.breaks,
      notes: notes.trim(),
    });

    onClose();
  };

  const recordedMs = netMs(recorded);
  const pausedMs = breakMs(recorded);
  const { mainTime, subTime } = formatTimeDisplay(recordedMs, { includeMilliseconds: true });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-gray-200/90 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-gray-900">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50/80 border-b border-gray-200">
          <div className="flex items-center gap-2 text-[#2D5BFF] font-semibold text-base">
            <Save className="w-5 h-5" />
            <span>Save Time Tracking Session</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Duration Summary Ribbon */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-400 block font-medium">Recorded Time</span>
              <span className="text-2xl font-mono font-bold text-gray-900">
                {mainTime}
                <span className="text-[#2D5BFF] text-sm">{subTime}</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400 block font-medium">Human Duration</span>
              <span className="text-sm font-semibold text-[#2D5BFF]">
                {formatDurationHuman(recordedMs)}
              </span>
              {pausedMs > 0 && (
                <span className="block text-[10px] text-gray-400">
                  minus {formatDurationHuman(pausedMs)} paused
                </span>
              )}
            </div>
          </div>

          {/* Session Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Session Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Feature Implementation / Workout"
              className="w-full bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#2D5BFF] focus:bg-white transition-colors"
              required
            />
          </div>

          {/* Project Categorization */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
              <Folder className="w-3.5 h-3.5 text-[#2D5BFF]" />
              <span>Project / Category</span>
            </label>
            <select
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
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-purple-500" />
              <span>Tags (comma-separated)</span>
            </label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="coding, sprint-1, meeting"
              className="w-full bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#2D5BFF] focus:bg-white transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>Session Notes (Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Brief summary of tasks accomplished during this time..."
              rows={3}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#2D5BFF] focus:bg-white transition-colors resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full text-xs font-medium text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Discard
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Save Session Entry</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
