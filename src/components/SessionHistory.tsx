import React, { useState, useMemo } from 'react';
import { TimeEntry, Project } from '../types';
import { breakMs, isRunning, netMs, totalNetMs } from '../domain/timeEntry';
import { useNow } from '../hooks/useNow';
import {
  formatTimeDisplay,
  formatDateTime,
  formatTimeOfDay,
  formatDurationHuman,
} from '../utils/timeFormatters';
import {
  Clock,
  Search,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
} from 'lucide-react';

interface SessionHistoryProps {
  entries: TimeEntry[];
  projects: Project[];
  onDeleteEntry: (id: string) => void;
  onEditEntry: (entry: TimeEntry) => void;
  onAddEntry: () => void;
  onClearAll: () => void;
  onExportPdf: () => void;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({
  entries,
  projects,
  onDeleteEntry,
  onEditEntry,
  onAddEntry,
  onClearAll,
  onExportPdf,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  const projectMap = useMemo(
    () => new Map<string, Project>(projects.map((p) => [p.id, p])),
    [projects]
  );

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesProject = selectedProjectId === 'all' || entry.project === selectedProjectId;

      return matchesSearch && matchesProject;
    });
  }, [entries, searchTerm, selectedProjectId]);

  // One clock for the whole list: a running entry must not be counted with a
  // different "now" in the total than in its own row. It only ticks while
  // something is actually running.
  const anyRunning = useMemo(() => entries.some(isRunning), [entries]);
  const now = useNow(anyRunning ? 1000 : null);

  const totalCalculatedMs = useMemo(() => totalNetMs(filteredEntries, now), [filteredEntries, now]);

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200/90 p-8 text-center my-6 shadow-xs">
        <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-gray-700">Noch keine Einträge</h3>
        <p className="text-xs text-gray-400 mt-1">
          Stoppuhr starten — oder bereits geleistete Zeit nachtragen.
        </p>
        <button
          onClick={onAddEntry}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Eintrag hinzufügen</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 p-6 my-6 shadow-xs">
      {/* History Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#2D5BFF]" />
            <span>Erfasste Zeiten</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Gesamt:{' '}
            <strong className="text-[#2D5BFF]">{formatDurationHuman(totalCalculatedMs)}</strong> (
            {filteredEntries.length} {filteredEntries.length === 1 ? 'Eintrag' : 'Einträge'})
          </p>
        </div>

        {/* Wraps, and the labels inside the pills do not. Three fixed buttons
            on one line do not fit a 320px phone: the text broke inside each
            pill, overflowed it and the three ran into one another — seen on a
            Fairphone 6. A second line is the worst case now. */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onAddEntry}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white text-xs font-semibold whitespace-nowrap shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Eintrag hinzufügen</span>
          </button>
          <button
            onClick={onExportPdf}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 text-xs font-semibold whitespace-nowrap shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#2D5BFF] shrink-0" />
            <span>PDF-Export</span>
          </button>
          {entries.length > 0 && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    'Wirklich alle Einträge löschen? Vorher wird eine Sicherung angelegt.'
                  )
                ) {
                  onClearAll();
                }
              }}
              className="text-xs text-rose-500 hover:text-rose-600 px-2.5 py-1 whitespace-nowrap transition-colors cursor-pointer"
            >
              Alle löschen
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3 my-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Titel, Notizen, Schlagwörter durchsuchen…"
            className="w-full bg-gray-50 border border-gray-200/90 rounded-full pl-9 pr-4 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#2D5BFF] focus:bg-white"
          />
        </div>

        {/* Project Filter */}
        <div className="min-w-[150px]">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200/90 rounded-full px-3.5 py-2 text-xs text-gray-700 focus:outline-none focus:border-[#2D5BFF] focus:bg-white cursor-pointer"
          >
            <option value="all">Alle Projekte</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* History Items List */}
      <div className="space-y-3">
        {filteredEntries.map((entry, index) => {
          const project = projectMap.get(entry.project);
          const projectColor = project ? project.color : '#2D5BFF';
          const projectName = project ? project.name : 'Allgemein';
          const isExpanded = expandedEntryId === entry.id;
          const entryNetMs = netMs(entry, now);
          const entryBreakMs = breakMs(entry, now);
          const running = isRunning(entry);

          const { mainTime, subTime } = formatTimeDisplay(entryNetMs, {
            includeMilliseconds: true,
          });

          return (
            <div
              key={entry.id}
              className={`bg-gray-50/70 border border-gray-200/80 rounded-xl p-4 transition-all hover:border-gray-300 ${
                index === 0 ? 'border-l-4 border-l-[#2D5BFF]' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: projectColor }}
                    title={projectName}
                  />
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-gray-900 truncate">{entry.title}</h4>
                    <div className="flex items-center gap-2 text-[0.6875rem] text-gray-400 mt-0.5">
                      <span className="font-semibold text-gray-600">{projectName}</span>
                      <span>•</span>
                      <span>{formatDateTime(entry.startTime)}</span>
                      {running && (
                        <>
                          <span>•</span>
                          <span className="font-semibold text-[#2D5BFF]">läuft</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <span className="text-base font-mono font-bold text-gray-900">
                      {mainTime}
                      <span className="text-xs text-[#2D5BFF]">{subTime}</span>
                    </span>
                    <span className="block text-[0.625rem] text-gray-400">
                      {formatDurationHuman(entryNetMs)}
                    </span>
                  </div>

                  <button
                    onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                    className="p-1.5 rounded-full bg-white text-gray-400 hover:text-gray-700 border border-gray-200 shadow-2xs transition-colors cursor-pointer"
                    title="Details ein-/ausblenden"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    onClick={() => onEditEntry(entry)}
                    className="p-1.5 rounded-full bg-white text-gray-400 hover:text-[#2D5BFF] border border-gray-200 shadow-2xs transition-colors cursor-pointer"
                    title="Eintrag bearbeiten"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onDeleteEntry(entry.id)}
                    className="p-1.5 rounded-full bg-white text-gray-400 hover:text-rose-500 border border-gray-200 shadow-2xs transition-colors cursor-pointer"
                    title="Eintrag löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tags Preview */}
              {entry.tags.length > 0 && !isExpanded && (
                <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-gray-200/60">
                  {entry.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-[0.625rem] bg-white text-gray-600 px-2.5 py-0.5 rounded-full border border-gray-200"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Expanded Entry Details */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-200 text-xs space-y-2">
                  {entry.notes && (
                    <div className="bg-white p-3 rounded-lg border border-gray-200 text-gray-700">
                      <strong className="text-gray-400 block text-[0.625rem] uppercase tracking-wider mb-1">
                        Notiz
                      </strong>
                      {entry.notes}
                    </div>
                  )}

                  {entry.breaks.length > 0 && (
                    <div>
                      <strong className="text-gray-400 block text-[0.625rem] uppercase tracking-wider mb-1">
                        Pausen ({entry.breaks.length}) — zusammen{' '}
                        {formatDurationHuman(entryBreakMs)}
                      </strong>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[0.6875rem]">
                        {entry.breaks.map((pause, i) => (
                          <div
                            key={pause.id}
                            className="bg-white px-2.5 py-1 rounded border border-gray-200 flex justify-between gap-2"
                          >
                            <span className="text-gray-400">#{i + 1}</span>
                            <span className="text-gray-800 font-semibold">
                              {formatTimeOfDay(pause.startTime)} —{' '}
                              {pause.endTime === null ? 'läuft' : formatTimeOfDay(pause.endTime)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
