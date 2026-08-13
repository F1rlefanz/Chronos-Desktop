import React, { useMemo, useState } from 'react';
import { TimeEntry, Project, PdfExportOptions, AppSettings } from '../types';
import { generatePdfReport } from '../utils/pdfExporter';
import { exportToCsv, exportToJsonBackup } from '../utils/dataExporter';
import {
  defaultExportRange,
  resolveExportRange,
  selectEntriesForExport,
} from '../domain/exportRange';
import { formatDurationHuman } from '../utils/timeFormatters';
import { totalNetMs } from '../domain/timeEntry';
import { ExportRangePicker } from './ExportRangePicker';
import { FileText, FileSpreadsheet, FileCode, Download, X, AlertCircle } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: TimeEntry[];
  projects: Project[];
  settings: AppSettings;
  /** Passed in rather than read here, so "this month" means the same thing
      everywhere on screen and the component stays pure. */
  now: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  entries,
  projects,
  settings,
  now,
}) => {
  const [activeTab, setActiveTab] = useState<'pdf' | 'csv' | 'json'>('pdf');

  // The period and project apply to the PDF and the CSV alike: the same
  // question, asked once, however the answer is formatted. Only the JSON
  // backup ignores them, because a partial backup is not a backup.
  const [range, setRange] = useState(() => defaultExportRange(now));
  const [projectId, setProjectId] = useState('all');

  const [pdfOptions, setPdfOptions] = useState<PdfExportOptions>({
    title: 'Time Tracking Report',
    author: 'Chronos',
    includeNotes: true,
    includeSummary: true,
  });

  const resolved = useMemo(() => resolveExportRange(range, now), [range, now]);

  const selection = useMemo(
    () =>
      resolved.error
        ? { entries: [], skippedRunning: 0 }
        : selectEntriesForExport(entries, resolved.range, projectId),
    [entries, resolved, projectId]
  );

  const availableYears = useMemo(() => {
    const years = new Set(entries.map((e) => new Date(e.startTime).getFullYear()));
    years.add(new Date(now).getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [entries, now]);

  if (!isOpen) return null;

  const blocked = resolved.error !== null || selection.entries.length === 0;

  const handleGeneratePdf = () => {
    generatePdfReport(selection.entries, projects, pdfOptions, resolved);
  };

  const handleExportCsv = () => {
    exportToCsv(selection.entries, projects, resolved.slug);
  };

  const handleExportJson = () => {
    exportToJsonBackup(entries, projects, settings);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-gray-200/90 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50/80 border-b border-gray-200">
          <div className="flex items-center gap-2 text-[#2D5BFF] font-semibold text-base">
            <Download className="w-5 h-5" />
            <span>Export & Data Reports</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-gray-200 bg-gray-50/50 p-2 gap-2">
          <button
            onClick={() => setActiveTab('pdf')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'pdf'
                ? 'bg-[#2D5BFF] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>PDF Document</span>
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'csv'
                ? 'bg-[#2D5BFF] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>CSV Spreadsheet</span>
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'json'
                ? 'bg-[#2D5BFF] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>JSON Backup</span>
          </button>
        </div>

        {/* What goes in, chosen once for every format that respects it. */}
        {activeTab !== 'json' && (
          <div className="px-6 pt-5 space-y-3 border-b border-gray-100 pb-5">
            <div className="grid grid-cols-2 gap-3">
              <ExportRangePicker
                value={range}
                onChange={setRange}
                availableYears={availableYears}
              />
              <div className="space-y-2">
                <label
                  htmlFor="export-project"
                  className="block text-xs font-semibold text-gray-700"
                >
                  Project
                </label>
                <select
                  id="export-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-full px-3.5 py-2 text-xs text-gray-700 focus:outline-none focus:border-[#2D5BFF] focus:bg-white cursor-pointer"
                >
                  <option value="all">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {resolved.error ? (
              <p role="alert" className="flex items-center gap-1.5 text-xs text-red-700">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {resolved.error}
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                {selection.entries.length === 0 ? (
                  'No finished entries in this period.'
                ) : (
                  <>
                    <strong className="text-gray-800">{selection.entries.length}</strong>{' '}
                    {selection.entries.length === 1 ? 'entry' : 'entries'} ·{' '}
                    <strong className="text-[#2D5BFF]">
                      {formatDurationHuman(totalNetMs(selection.entries))}
                    </strong>{' '}
                    · {resolved.label}
                  </>
                )}
              </p>
            )}

            {/* Said out loud rather than quietly dropped: the number has to
                match what the file contains, or the export is not a record. */}
            {selection.skippedRunning > 0 && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                {selection.skippedRunning} running{' '}
                {selection.skippedRunning === 1 ? 'measurement is' : 'measurements are'} left out —
                a duration that is still growing would make this report different every time.
              </p>
            )}
          </div>
        )}

        {/* Tab Body */}
        <div className="p-6 space-y-4">
          {activeTab === 'pdf' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Report Title
                </label>
                <input
                  type="text"
                  value={pdfOptions.title}
                  onChange={(e) => setPdfOptions({ ...pdfOptions, title: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#2D5BFF] focus:bg-white"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-100">
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeSummary}
                    onChange={(e) =>
                      setPdfOptions({ ...pdfOptions, includeSummary: e.target.checked })
                    }
                    className="rounded bg-gray-50 border-gray-300 text-[#2D5BFF] focus:ring-0"
                  />
                  <span>Include Summary Statistics Card</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeNotes}
                    onChange={(e) =>
                      setPdfOptions({ ...pdfOptions, includeNotes: e.target.checked })
                    }
                    className="rounded bg-gray-50 border-gray-300 text-[#2D5BFF] focus:ring-0"
                  />
                  <span>Include Session Notes Column</span>
                </label>
              </div>

              <button
                onClick={handleGeneratePdf}
                disabled={blocked}
                className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#2D5BFF] hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Generate PDF Report Download</span>
              </button>
            </div>
          )}

          {activeTab === 'csv' && (
            <div className="space-y-4 text-center py-4">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-gray-600 text-xs">
                Export all session records to an editable <strong>.CSV file</strong> compatible with
                Microsoft Excel, Google Sheets, or custom data processing software.
              </div>
              <button
                onClick={handleExportCsv}
                disabled={blocked}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#2D5BFF] hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download CSV File</span>
              </button>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="space-y-4 text-center py-4">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-gray-600 text-xs">
                Export your complete app state (settings, custom projects, time entries and their
                breaks) to a portable <strong>.JSON file</strong> to share or move between PCs
                without losing data.
              </div>
              <button
                onClick={handleExportJson}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <FileCode className="w-4 h-4" />
                <span>Download Portable JSON State</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
